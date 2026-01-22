import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate(); // Hook for redirection
  const [role, setRole] = useState('owner');
  
  const isDirectOwnerSignup = searchParams.get('type') === 'owner';

  useEffect(() => {
    if (isDirectOwnerSignup) setRole('owner');
  }, [isDirectOwnerSignup]);

  // Handle the form submission
  const handleSignup = (e) => {
    e.preventDefault();
    // Logic for API calls would go here
    console.log(`Registered as ${role}`);
    
    // Redirect to login page after successful "registration"
    navigate('/login');
  };

  return (
    <div 
      className="min-h-screen font-sans flex items-center justify-center px-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)), url('src/assets/1a.png')" }}
    >
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-slate-100">
        
        <div className="text-center mb-8">
          <Link to="/" className="w-12 h-12 bg-amber-800 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 block">
            P
          </Link>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isDirectOwnerSignup ? 'Owner Registration' : 'Create Account'}
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            {isDirectOwnerSignup 
              ? 'Register your business to get started' 
              : `Join Prodtrack as ${role === 'owner' ? 'an Owner' : 'Staff'}`}
          </p>
        </div>

        {!isDirectOwnerSignup && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
            <button 
              onClick={() => setRole('owner')} 
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${role === 'owner' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              OWNER
            </button>
            <button 
              onClick={() => setRole('staff')} 
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${role === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              STAFF
            </button>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
            <input required type="text" placeholder="Your Name" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
            <input required type="email" placeholder="email@business.com" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
            <input required type="tel" placeholder="Phone Number" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Password</label>
            <input required type="password" placeholder="••••••••" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          </div>

          <button 
            type="submit"
            className="w-full bg-amber-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-900 transition mt-4"
          >
            {role === 'owner' ? 'REGISTER BUSINESS' : 'JOIN AS STAFF'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6 font-medium">
          Already have an account? <Link to="/login" className="text-amber-800 font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;