import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import Input from '../components/Input';
import Button from '../components/Button';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'user'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert user data into the users table using the service role client
        const { data: userData, error: dbError } = await supabase.rpc('create_new_user', {
          user_id: authData.user.id,
          user_email: email,
          user_name: name,
          user_role: 'user'
        });

        if (dbError) throw dbError;

        toast.success('Registration successful! Please check your email to confirm your account.');
        navigate('/login');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message.includes('User already registered')) {
        toast.error('This email is already registered. Please try logging in instead.');
      } else if (error.message.includes('rate limit')) {
        toast.error('Too many registration attempts. Please try again in a few minutes.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // If user is already logged in, don't render the register form
  if (user) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Create an Account
        </h2>
        
        <form onSubmit={handleRegister} className="space-y-6">
          <Input
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="John Doe"
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            minLength={6}
          />

          <Button type="submit" loading={loading} fullWidth>
            Register
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}