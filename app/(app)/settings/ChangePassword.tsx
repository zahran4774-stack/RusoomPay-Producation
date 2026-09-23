'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import styles from './ChangePassword.module.css';

interface PasswordRequirement {
  name: string;
  regex: RegExp;
  met: boolean;
}

export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([
    { name: 'At least 10 characters', regex: /.{10,}/, met: false },
    { name: 'Uppercase letter (A-Z)', regex: /[A-Z]/, met: false },
    { name: 'Lowercase letter (a-z)', regex: /[a-z]/, met: false },
    { name: 'Number (0-9)', regex: /[0-9]/, met: false },
    { name: 'Special character (!@#$%)', regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, met: false },
  ]);

  useEffect(() => {
    const updated = passwordRequirements.map(req => ({
      ...req,
      met: req.regex.test(newPassword),
    }));
    setPasswordRequirements(updated);
  }, [newPassword]);

  const allRequirementsMet = passwordRequirements.every(req => req.met);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isFormValid = allRequirementsMet && passwordsMatch && currentPassword.length > 0;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setError('Please meet all requirements and ensure passwords match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('Unable to verify account.');
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (authError) {
        setError('Current password is incorrect.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password.');
      } else {
        setSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Change Password</h1>

        <form onSubmit={handleChangePassword} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword" className={styles.label}>
              Current Password
            </label>
            <div className={styles.passwordInputWrapper}>
              <input
                id="currentPassword"
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter your current password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.toggleButton}
              >
                {showPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="newPassword" className={styles.label}>
              New Password
            </label>
            <div className={styles.passwordInputWrapper}>
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter your new password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className={styles.toggleButton}
              >
                {showNewPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>

            <div className={styles.requirementsList}>
              <p className={styles.requirementsTitle}>Password Requirements:</p>
              {passwordRequirements.map((req, idx) => (
                <div key={idx} className={styles.requirement}>
                  <span className={req.met ? styles.checkMet : styles.checkUnmet}>
                    {req.met ? '✓' : '✕'}
                  </span>
                  <span className={req.met ? styles.textMet : styles.textUnmet}>
                    {req.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <div className={styles.passwordInputWrapper}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="Confirm your new password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={styles.toggleButton}
              >
                {showConfirmPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
            {newPassword && confirmPassword && !passwordsMatch && (
              <p className={styles.matchError}>Passwords do not match</p>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className={styles.submitButton}
            style={{
              opacity: isFormValid && !loading ? 1 : 0.5,
              cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className={styles.footer}>
          For security reasons, you will need to log in again after changing your password.
        </p>
      </div>
    </div>
  );
}
