import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [role, setRole] = useState('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const loginData = { 
  email: email, 
  password: password, 
  role: role // Sending the role currently selected by the toggle buttons
};
    try {
      const response = await fetch('http://localhost:8080/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        alert(`Successful Login as ${role}!`); // Alert logic preserved
      } else {
        alert("Invalid credentials! Please try again.");
      }
    } catch (error) {
      alert("Backend Error: Is main.go running on port 8080?");
    }
  };

  return (
    <div className="min-h-screen font-sans flex items-center justify-center px-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)), url('src/assets/1a.png')" }}>
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-slate-100">
        <div className="text-center mb-10">
          <Link to="/" className="w-12 h-12 bg-amber-800 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 block">P</Link>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h2>
          <p className="text-slate-500 mt-2 font-medium">Log in as {role} to continue</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
          <button onClick={() => setRole('owner')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${role === 'owner' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>OWNER</button>
          <button onClick={() => setRole('staff')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${role === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>STAFF</button>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <input required type="email" placeholder="Email Address" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-amber-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-900 transition">LOGIN</button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;