import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div 
      className="min-h-screen font-sans text-slate-900 bg-white bg-cover bg-center bg-no-repeat" 
      style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.7), rgba(255,255,255,0.7)), url('src/assets/1a.png')" }}
    >
      <nav className="flex justify-between items-center px-10 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-amber-800 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md">P</div>
          <span className="text-2xl font-black text-slate-800 tracking-tight">PRODTRACK</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="px-6 py-2 bg-amber-800 text-white rounded-full font-bold text-sm hover:bg-amber-900 transition shadow-lg shadow-blue-200">
            LOGIN
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-10 pt-12 pb-16 text-center space-y-8">
        <h1 className="text-5xl font-black text-slate-900 leading-tight">
          Inventory Management <br /> <span className="text-blue-600">Made Simple.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Track stock in real-time and manage your business from anywhere.
        </p>
        
        <div className="flex justify-center">
          {/* Special link for Business Owners */}
          <Link 
            to="/signup?type=owner" 
            className="bg-amber-800 text-white px-8 py-3 rounded-xl font-bold text-md shadow-lg hover:bg-amber-900 transition"
          >
            Sign up as Business Owner
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          {[{ title: 'Tracking', icon: '📦' }, { title: 'Insights', icon: '📊' }, { title: 'Alerts', icon: '🔔' }].map((s, i) => (
            <div key={i} className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="text-2xl bg-blue-50 w-12 h-12 flex items-center justify-center rounded-xl">{s.icon}</div>
              <h3 className="font-bold text-slate-800">{s.title}</h3>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default LandingPage;