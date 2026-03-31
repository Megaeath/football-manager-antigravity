'use client';

import { useEffect, useState } from 'react';

export default function TestListedPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/players/search')
            .then(res => res.json())
            .then(data => {
                console.log('=== API RESPONSE ===');
                console.log('Total players:', data.length);
                const listed = data.filter((p: any) => p.transferStatus === 'LISTED');
                console.log('Listed players:', listed.length);
                console.log('First listed:', listed[0]);
                console.log('First player keys:', Object.keys(data[0] || {}));
                setData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error:', err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div>Loading...</div>;

    const listedPlayers = data.filter((p: any) => p.transferStatus === 'LISTED');

    return (
        <div style={{ padding: '20px' }}>
            <h1>Test Listed Players</h1>
            <p>Total: {data.length}</p>
            <p>Listed: {listedPlayers.length}</p>
            
            <h2>Listed Players ({listedPlayers.length})</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #ccc' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Price</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Team</th>
                    </tr>
                </thead>
                <tbody>
                    {listedPlayers.slice(0, 20).map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{p.name}</td>
                            <td style={{ padding: '8px' }}>{p.transferStatus}</td>
                            <td style={{ padding: '8px' }}>{p.askingPrice?.toLocaleString()}</td>
                            <td style={{ padding: '8px' }}>{p.teamName}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
