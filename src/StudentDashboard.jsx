import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // This is where you will eventually fetch real data from your PostgreSQL backend
  const [roomData, setRoomData] = useState({
    room: "No room assigned",
    balance: "0.00",
    notice: "No new announcements"
  });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
      {/* Sidebar - Clean White with Blue accents */}
      <aside style={{ width: '260px', backgroundColor: 'white', color: '#1e40af', padding: '30px', borderRight: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '40px', color: '#2563eb' }}>Student Portal</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ padding: '12px 20px', backgroundColor: '#eff6ff', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Overview</div>
          <div style={{ padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>My Room</div>
          <div style={{ padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>Payments</div>
          <div style={{ padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>Settings</div>
        </nav>
      </aside>

      {/* Main Content - Clean White/Slate */}
      <main style={{ flex: 1 }}>
        <header style={{ backgroundColor: 'white', padding: '20px 40px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#334155' }}>Dashboard Overview</h1>
          <button 
            onClick={() => navigate('/')}
            style={{ color: '#ef4444', border: '1px solid #fee2e2', backgroundColor: '#fef2f2', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
            Logout
          </button>
        </header>

        <div style={{ padding: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px' }}>
            {/* Essential Card 1: Room */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '14px', textTransform: 'uppercase', fontWeight: 'bold' }}>Assigned Room</p>
              <h3 style={{ fontSize: '24px', color: roomData.room === "No room assigned" ? '#94a3b8' : '#1e40af', marginTop: '10px' }}>{roomData.room}</h3>
              <p style={{ color: roomData.room === "No room assigned" ? '#f87171' : '#10b981', fontSize: '14px', marginTop: '8px' }}>● {roomData.room === "No room assigned" ? "Unassigned" : "Occupied"}</p>
            </div>

            {/* Essential Card 2: Balance */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '14px', textTransform: 'uppercase', fontWeight: 'bold' }}>Current Balance</p>
              <h3 style={{ fontSize: '24px', color: '#1e293b', marginTop: '10px' }}>${roomData.balance}</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>No pending payments</p>
            </div>

            {/* Essential Card 3: Announcements */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '14px', textTransform: 'uppercase', fontWeight: 'bold' }}>Latest Notice</p>
              <h3 style={{ fontSize: '18px', color: '#1e293b', marginTop: '10px' }}>{roomData.notice}</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>Tomorrow, 10:00 AM</p>
            </div>
          </div>
          
          {/* Removed Unwanted Filler Sections Here */}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;