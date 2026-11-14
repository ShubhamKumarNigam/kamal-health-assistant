'use client';
import {useState} from 'react';
export function LocationPreference() {
  const [location,setLocation]=useState(null);
  const [message,setMessage]=useState('');
  function locate() {
    if (!navigator.geolocation) {setMessage('Location is unavailable in this browser.');return;}
    setMessage('Waiting for your permission and device location…');
    navigator.geolocation.getCurrentPosition(position=>{
      setLocation({lat:position.coords.latitude,lon:position.coords.longitude,accuracy:Math.round(position.coords.accuracy)});
      setMessage('Location obtained. It stays in this page and is not sent to KAMAL or the AI.');
    },()=>setMessage('Location could not be obtained. You can continue without it or check your browser permission.'),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  return <section className="care-card"><h2>Your location, your choice</h2><p>Use your device location when you want to find nearby care. Accuracy depends on your device. This does not enable emergency monitoring or background tracking.</p><button className="care-button" onClick={locate}>Use my location</button>{location && <div className="mt-4"><p>{location.lat.toFixed(5)}, {location.lon.toFixed(5)} · accuracy about {location.accuracy} metres</p><p className="mt-2">Opening the map shares these coordinates with OpenStreetMap.</p><a className="underline" href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=15/${location.lat}/${location.lon}`} target="_blank" rel="noreferrer">Open map</a><button className="ml-5 underline" onClick={()=>{setLocation(null);setMessage('Location cleared from this page.');}}>Clear location</button></div>}<p role="status" className="mt-3">{message}</p></section>;
}
