import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

// Use logo from public folder
const sturgisLogo = '/sturgis-logo.png';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const passwordStrength = () => {
    if (password.length === 0) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const getStrengthLabel = () => {
    const strength = passwordStrength();
    if (strength === 0) return '';
    if (strength === 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Good';
    return 'Strong';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await register(name, email, password, company);
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="auth-brand">
            <Link to="/" className="back-link">
              <ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
              Back to home
            </Link>
            <div className="brand-content">
              <img src={sturgisLogo} alt="Sturgis" className="auth-logo" />
              <h1>Get started today</h1>
              <p>Create your account and start managing your construction projects more efficiently.</p>
            </div>
            <div className="brand-features">
              <div className="brand-feature">
                <span className="feature-check">&#10003;</span>
                <span>Free 14-day trial</span>
              </div>
              <div className="brand-feature">
                <span className="feature-check">&#10003;</span>
                <span>No credit card required</span>
              </div>
              <div className="brand-feature">
                <span className="feature-check">&#10003;</span>
                <span>Full feature access</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2>Create account</h2>
              <p>Fill in your details to get started</p>
            </div>

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full name</label>
                  <div className="input-wrapper">
                    <User size={18} className="input-icon" />
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Smith"
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="company">Company <span className="optional">(optional)</span></label>
                  <div className="input-wrapper">
                    <Building2 size={18} className="input-icon" />
                    <input
                      type="text"
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Company name"
                      autoComplete="organization"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {password && (
                  <div className="password-strength">
                    <div className="strength-bars">
                      {[1, 2, 3, 4].map(level => (
                        <div
                          key={level}
                          className={`strength-bar ${passwordStrength() >= level ? 'active' : ''}`}
                          data-strength={passwordStrength()}
                        />
                      ))}
                    </div>
                    <span className={`strength-label strength-${passwordStrength()}`}>
                      {getStrengthLabel()}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    autoComplete="new-password"
                  />
                  {confirmPassword && password === confirmPassword && (
                    <Check size={18} className="input-valid" />
                  )}
                </div>
              </div>

              <div className="form-checkbox">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <label htmlFor="terms">
                  I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
                </label>
              </div>

              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Already have an account?{' '}
                <Link to="/login">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
