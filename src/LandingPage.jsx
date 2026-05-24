import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Navigation */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 80px', alignItems: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>HostelSync</div>
        <div style={{ display: 'flex', gap: '30px', fontWeight: '500', color: '#4b5563' }}>
          <span>Home</span>
          <span>About</span>
          <span>Features</span>
          <button 
            onClick={() => navigate('/login')}
            style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 25px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ padding: '100px 80px', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '64px', fontWeight: '800', color: '#111827', marginBottom: '24px', lineHeight: '1.1' }}>
          The Modern Way to Manage <span style={{ color: '#2563eb' }}>Student Living.</span>
        </h1>
        <p style={{ fontSize: '20px', color: '#6b7280', marginBottom: '40px', lineHeight: '1.6' }}>
          A streamlined portal for room applications, maintenance requests, and secure payments. 
          Designed specifically for university accommodation excellence.
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button style={{ backgroundColor: '#2563eb', color: 'white', padding: '15px 40px', borderRadius: '12px', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
            Apply for Room
          </button>
          <button style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '15px 40px', borderRadius: '12px', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            Contact Admin
          </button>
        </div>
      </header>

      {/* Clean Background Visual */}
      <div style={{ width: '80%', height: '400px', margin: '0 auto', backgroundColor: '#eff6ff', borderRadius: '24px', border: '1px solid #dbeafe' }}></div>
    </div>
  );
};

export default LandingPage;