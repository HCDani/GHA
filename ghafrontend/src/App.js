import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import AddGreenhouseModal from './AddGreenhouseModal';
import GreenhouseDetailPage from './pages/GreenhouseDetailPage';
import { pb } from './pbClient';
import { useAuth } from './contexts/AuthContext';
import CallbackPage from './pages/CallbackPage';
import ProtectedRoute from './components/ProtectedRoute';
import GrafanaPanelIframe from './components/GrafanaPanelIframe';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useWeather } from './hooks/useWeather';

/** Get lat/lon from user preferences (PocketBase preferences field). */
function getPrefsCoords(user) {
  if (!user) return { lat: null, lon: null, city: null };
  return user.preferences;
}

function GreenhouseList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [greenhouses, setGreenhouses] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { lat, lon, city } = getPrefsCoords(user);
  const { temperature, humidity, lightLux, loading: weatherLoading, error: weatherError } = useWeather(lat, lon);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const records = await pb.collection(`${user.id}_greenhouses`).getFullList({ sort: '-created' });
        if (!mounted) return;
        const mapped = records.map((r) => {
          return {
            id: r.id,
            title: r.title || '',
            description: r.description || '',
            order: r.order ?? 0,
            grafanadata: r.grafanadata ?? [],
          };
        });
        // Sort greenhouses by order field
        mapped.sort((a, b) => a.order - b.order);
        setGreenhouses(mapped);
      } catch (err) {
        console.error('Failed to load greenhouses from PocketBase', err);
        toast.error('Failed to load greenhouses');
      } finally {
        setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  function handleAddClick() {
    setEditingItem(null);
    setModalOpen(true);
  }

  async function handleSave(data) {
    setIsSaving(true);
    try {
      // Generate next order number based on existing greenhouses
      const nextOrder = greenhouses.length > 0 
        ? Math.max(...greenhouses.map(g => g.order)) + 1 
        : 0;
      
      const record = await pb.collection(`${user.id}_greenhouses`).create({
        title: data.title,
        description: data.description,
        order: nextOrder,
        grafanadata: data.grafanadata || [],
      });
      let gd = record.grafanadata ?? [];
      if (typeof gd === 'string') { try { gd = JSON.parse(gd); } catch { gd = []; } }
      if (!Array.isArray(gd)) gd = [];
      const next = {
        id: record.id,
        title: record.title || '',
        description: record.description || '',
        order: record.order ?? 0,
        grafanadata: gd,
      };
      setGreenhouses((s) => {
        const updated = [next, ...s];
        // Sort by order field
        updated.sort((a, b) => a.order - b.order);
        return updated;
      });
      setModalOpen(false);
      setEditingItem(null);
      toast.success('Greenhouse created');
    } catch (err) {
      console.error('Failed to save greenhouse to PocketBase', err);
      const next = { ...data, id: Date.now() };
      setGreenhouses((s) => {
        const updated = [next, ...s];
        // Sort by order field
        updated.sort((a, b) => a.order - b.order);
        return updated;
      });
      setModalOpen(false);
      setEditingItem(null);
      toast.error('Failed to save to server — added locally');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(id, data) {
    setUpdatingId(id);
    try {
      const newOrder = data.order ?? 0;
      const oldOrder = greenhouses.find((g) => g.id === id)?.order ?? 0;
      const conflictingGreenhouse = greenhouses.find(
        (g) => g.id !== id && g.order === newOrder
      );

      // If another greenhouse has this order, swap their orders
      if (conflictingGreenhouse) {
        await pb.collection(`${user.id}_greenhouses`).update(conflictingGreenhouse.id, {
          Order: oldOrder,
        });
      }

      const record = await pb.collection(`${user.id}_greenhouses`).update(id, {
        title: data.title,
        description: data.description,
        order: newOrder,
        grafanadata: data.grafanadata || [],
      });
      let gd = record.grafanadata ?? [];
      if (typeof gd === 'string') { try { gd = JSON.parse(gd); } catch { gd = []; } }
      if (!Array.isArray(gd)) gd = [];
      const next = {
        id: record.id,
        title: record.title || '',
        description: record.description || '',
        order: record.order ?? 0,
        grafanadata: gd,
      };
      setGreenhouses((s) => {
        const updated = s.map((it) => {
          if (it.id === id) {
            return next;
          }
          if (conflictingGreenhouse && it.id === conflictingGreenhouse.id) {
            return { ...it, order: oldOrder };
          }
          return it;
        });
        // Re-sort after update
        updated.sort((a, b) => a.order - b.order);
        return updated;
      });
      setModalOpen(false);
      setEditingItem(null);
      toast.success('Greenhouse updated');
    } catch (err) {
      console.error('Failed to update greenhouse in PocketBase', err);
      // fallback: update locally
      setGreenhouses((s) => s.map((it) => (it.id === id ? { ...it, ...data } : it)));
      setModalOpen(false);
      setEditingItem(null);
      toast.error('Failed to update on server — updated locally');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm('Delete this greenhouse?');
    if (!ok) return;
    try {
      setDeletingId(id);
      await pb.collection(`${user.id}_greenhouses`).delete(id);
      setGreenhouses((s) => s.filter((it) => it.id !== id));
      toast.success('Greenhouse deleted');
    } catch (err) {
      console.error('Failed to delete greenhouse from PocketBase', err);
      // fallback: remove locally
      setGreenhouses((s) => s.filter((it) => it.id !== id));
      toast.error('Failed to delete from server — removed locally');
    }
    setDeletingId(null);
  }

  function handleClose() {
    setModalOpen(false);
  }

  return (
    <main className="app-body">
      <header className="app-header">
        <div className="header-left">
          <h1>Greenhouses</h1>
          {(lat != null && lon != null) && (
            <div className="header-weather" aria-label="Local weather">
              {weatherLoading && <span className="weather-loading">Loading weather…</span>}
              {weatherError && !weatherLoading && <span className="weather-error">{weatherError}</span>}
              {!weatherLoading && !weatherError && (temperature != null || humidity != null || lightLux != null) && (
                <>
                  <span className="weather-label">Weather data: {city}</span>
                  {temperature != null && <span>Temp: {temperature}°C</span>}
                  {humidity != null && <span>Humidity: {humidity}%</span>}
                  {lightLux != null && <span>Light: {lightLux} lux</span>}
                </>
              )}
            </div>
          )}
        </div>
        <div className="header-center">
          <button className="add-btn" onClick={handleAddClick}>
            Add a new greenhouse
          </button>
        </div>
        <div className="header-right">
          <div className="user-info">
            {user && <span>Welcome, {user.email || user.username}</span>}
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="app-content">
        {greenhouses.map((g, cardIndex) => (
          <article
            key={g.id}
            className="greenhouse-card"
            onClick={() => navigate(`/greenhouse/${g.id}`)}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/greenhouse/${g.id}`);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{g.title}</h2>
              <div
                style={{ display: 'flex', gap: '0.5rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingItem(g);
                    setModalOpen(true);
                  }}
                  disabled={updatingId === g.id || deletingId === g.id}
                >
                  {updatingId === g.id ? 'Updating…' : 'Edit'}
                </button>
                <button
                  className="btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(g.id);
                  }}
                  disabled={deletingId === g.id}
                >
                  {deletingId === g.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
            {g.description && <p>{g.description}</p>}
            {g.grafanadata && g.grafanadata.length > 0 ? (
              (() => {
                const item = g.grafanadata[0];
                const url = item && (item.grafanaURL || item.grafanaUrl);
                if (!url) return <div className="no-grafana">No Grafana panels</div>;
                return (
                  <div className="grafana-wrap">
                    <GrafanaPanelIframe
                      title={`grafana-${g.id}-0`}
                      src={url}
                      staggerIndex={cardIndex}
                    />
                  </div>
                );
              })()
            ) : (
              <div className="no-grafana">No Grafana panels</div>
            )}
          </article>
        ))}
      </section>

      <footer className="app-footer"></footer>

      <AddGreenhouseModal
        open={modalOpen}
        onClose={() => { handleClose(); setEditingItem(null); }}
        onSave={(data) => (editingItem ? handleUpdate(editingItem.id, data) : handleSave(data))}
        initial={editingItem ? editingItem : {}}
        isSubmitting={isSaving || (editingItem ? updatingId === editingItem.id : false)}
        availableOrders={
          editingItem && greenhouses.length > 0
            ? Array.from(
                { length: Math.max(...greenhouses.map((g) => g.order), 0) + 1 },
                (_, i) => i
              )
            : []
        }
      />
      <ToastContainer position="top-right" autoClose={3000} />
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <GreenhouseList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/greenhouse/:id"
          element={
            <ProtectedRoute>
              <GreenhouseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
export { GreenhouseList };
