"""
Azure Blob Storage service for persistent data storage
Handles database backup/restore to survive Azure App Service deployments
"""
import os
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional


# Check if Azure Storage is available
try:
    from azure.storage.blob import BlobServiceClient, BlobClient
    AZURE_STORAGE_AVAILABLE = True
except ImportError:
    AZURE_STORAGE_AVAILABLE = False
    print("Azure Storage SDK not installed. Running in local mode.")


class AzureStorageService:
    """
    Service for persisting SQLite database to Azure Blob Storage.

    On startup: Downloads the database from blob storage (if exists)
    Periodically: Backs up the database to blob storage
    On shutdown: Final backup to blob storage

    Environment Variables:
        AZURE_STORAGE_CONNECTION_STRING: Full connection string for Azure Storage
        AZURE_STORAGE_CONTAINER: Container name (default: 'sturgis-data')
        AZURE_STORAGE_BLOB_NAME: Blob name for database (default: 'projects.db')
        AZURE_STORAGE_ENABLED: Set to 'true' to enable (default: auto-detect)
        AZURE_BACKUP_INTERVAL: Backup interval in seconds (default: 300 = 5 minutes)
    """

    def __init__(self, local_db_path: str):
        self.local_db_path = Path(local_db_path)
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
        self.container_name = os.getenv("AZURE_STORAGE_CONTAINER", "sturgis-project-data")
        self.blob_name = os.getenv("AZURE_STORAGE_BLOB_NAME", "projects.db")
        self.backup_interval = int(os.getenv("AZURE_BACKUP_INTERVAL", "60"))  # 1 minute for Container Apps

        # Check if Azure Storage should be enabled
        enabled_env = os.getenv("AZURE_STORAGE_ENABLED", "auto")
        if enabled_env.lower() == "true":
            self.enabled = True
        elif enabled_env.lower() == "false":
            self.enabled = False
        else:
            # Auto-detect: enable if connection string is provided
            self.enabled = bool(self.connection_string) and AZURE_STORAGE_AVAILABLE

        self.blob_client: Optional[BlobClient] = None
        self._backup_thread: Optional[threading.Thread] = None
        self._stop_backup = threading.Event()
        self._last_backup_hash: Optional[str] = None

        if self.enabled:
            self._init_client()
            print(f"Azure Storage: Enabled (container: {self.container_name}, blob: {self.blob_name})")
        else:
            if not self.connection_string:
                print("Azure Storage: Disabled (no connection string)")
            elif not AZURE_STORAGE_AVAILABLE:
                print("Azure Storage: Disabled (SDK not installed)")
            else:
                print("Azure Storage: Disabled (explicitly)")

    def _init_client(self):
        """Initialize the Azure Blob client"""
        try:
            blob_service = BlobServiceClient.from_connection_string(self.connection_string)

            # Ensure container exists
            container_client = blob_service.get_container_client(self.container_name)
            try:
                container_client.get_container_properties()
            except Exception:
                print(f"Azure Storage: Creating container '{self.container_name}'")
                container_client.create_container()

            self.blob_client = blob_service.get_blob_client(
                container=self.container_name,
                blob=self.blob_name
            )
            print("Azure Storage: Client initialized successfully")
        except Exception as e:
            print(f"Azure Storage: Failed to initialize client: {e}")
            self.enabled = False

    def _get_file_hash(self, file_path: Path) -> str:
        """Get a simple hash of file for change detection"""
        if not file_path.exists():
            return ""
        stat = file_path.stat()
        return f"{stat.st_size}-{stat.st_mtime}"

    def restore_from_azure(self) -> bool:
        """
        Download database from Azure Blob Storage on startup.
        Returns True if database was restored, False otherwise.
        """
        if not self.enabled or not self.blob_client:
            return False

        try:
            # Check if blob exists
            if not self.blob_client.exists():
                print("Azure Storage: No existing database in blob storage")
                return False

            # Create backup of local file if it exists
            if self.local_db_path.exists():
                backup_path = self.local_db_path.with_suffix('.db.local_backup')
                shutil.copy2(self.local_db_path, backup_path)
                print(f"Azure Storage: Backed up local database to {backup_path}")

            # Download from Azure
            print(f"Azure Storage: Downloading database from blob storage...")
            self.local_db_path.parent.mkdir(parents=True, exist_ok=True)

            with open(self.local_db_path, "wb") as f:
                download_stream = self.blob_client.download_blob()
                f.write(download_stream.readall())

            file_size = self.local_db_path.stat().st_size
            print(f"Azure Storage: Database restored successfully ({file_size:,} bytes)")
            self._last_backup_hash = self._get_file_hash(self.local_db_path)
            return True

        except Exception as e:
            print(f"Azure Storage: Failed to restore database: {e}")
            return False

    def backup_to_azure(self, force: bool = False) -> bool:
        """
        Upload database to Azure Blob Storage.
        Only uploads if the file has changed (unless force=True).
        Returns True if backup was performed, False otherwise.
        """
        if not self.enabled or not self.blob_client:
            return False

        try:
            if not self.local_db_path.exists():
                print("Azure Storage: No local database to backup")
                return False

            # Check if file has changed
            current_hash = self._get_file_hash(self.local_db_path)
            if not force and current_hash == self._last_backup_hash:
                return False  # No changes, skip backup

            # Upload to Azure
            file_size = self.local_db_path.stat().st_size
            print(f"Azure Storage: Backing up database ({file_size:,} bytes)...")

            with open(self.local_db_path, "rb") as f:
                self.blob_client.upload_blob(f, overwrite=True)

            self._last_backup_hash = current_hash
            print(f"Azure Storage: Backup completed at {datetime.now().isoformat()}")
            return True

        except Exception as e:
            print(f"Azure Storage: Failed to backup database: {e}")
            return False

    def start_periodic_backup(self):
        """Start background thread for periodic backups"""
        if not self.enabled:
            return

        self._stop_backup.clear()
        self._backup_thread = threading.Thread(target=self._backup_loop, daemon=True)
        self._backup_thread.start()
        print(f"Azure Storage: Started periodic backup (every {self.backup_interval}s)")

    def stop_periodic_backup(self):
        """Stop background backup thread and perform final backup"""
        if self._backup_thread:
            self._stop_backup.set()
            self._backup_thread.join(timeout=5)

        # Final backup on shutdown
        if self.enabled:
            print("Azure Storage: Performing final backup on shutdown...")
            self.backup_to_azure(force=True)

    def _backup_loop(self):
        """Background loop for periodic backups"""
        while not self._stop_backup.wait(self.backup_interval):
            try:
                self.backup_to_azure()
            except Exception as e:
                print(f"Azure Storage: Periodic backup error: {e}")

    def get_status(self) -> dict:
        """Get current status of Azure Storage service"""
        return {
            "enabled": self.enabled,
            "container": self.container_name if self.enabled else None,
            "blob": self.blob_name if self.enabled else None,
            "backup_interval_seconds": self.backup_interval if self.enabled else None,
            "local_db_exists": self.local_db_path.exists(),
            "local_db_size": self.local_db_path.stat().st_size if self.local_db_path.exists() else 0,
            "last_backup_hash": self._last_backup_hash
        }


# Singleton instance (initialized lazily)
_azure_storage: Optional[AzureStorageService] = None


def get_azure_storage(local_db_path: str = None) -> AzureStorageService:
    """Get or create the Azure Storage service singleton"""
    global _azure_storage

    if _azure_storage is None:
        if local_db_path is None:
            from database import DATA_DIR
            local_db_path = os.path.join(DATA_DIR, "projects.db")
        _azure_storage = AzureStorageService(local_db_path)

    return _azure_storage


def init_azure_storage(local_db_path: str) -> AzureStorageService:
    """
    Initialize Azure Storage and restore database from blob storage.
    Call this at application startup BEFORE initializing the database.
    """
    storage = get_azure_storage(local_db_path)

    # Try to restore from Azure on startup
    storage.restore_from_azure()

    # Start periodic backups
    storage.start_periodic_backup()

    return storage


def shutdown_azure_storage():
    """
    Shutdown Azure Storage service gracefully.
    Call this at application shutdown.
    """
    global _azure_storage
    if _azure_storage:
        _azure_storage.stop_periodic_backup()
