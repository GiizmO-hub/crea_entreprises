import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, ExternalLink, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'invoice' | 'client' | 'payment' | 'subscription' | 'system';
  link_url?: string;
  link_text?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
  metadata?: any;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch (error) {
      console.error('Erreur marquer comme lu:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data, error } = await supabase.rpc('mark_all_notifications_as_read');

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      alert(`✅ ${data || 0} notification(s) marquée(s) comme lue(s)`);
    } catch (error) {
      console.error('Erreur marquer toutes comme lues:', error);
      alert('❌ Erreur lors de la mise à jour');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const deleteAllRead = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les notifications lues ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('read', true);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !n.read));
      alert('✅ Notifications lues supprimées');
    } catch (error) {
      console.error('Erreur suppression notifications lues:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.link_url) {
      window.location.hash = notification.link_url.replace('#', '');
    }
  };

  useEffect(() => {
    loadNotifications();

    // Écouter les nouvelles notifications en temps réel
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'invoice':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'payment':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'client':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'subscription':
        return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
        </div>
        <p className="text-gray-400">Gérez toutes vos notifications</p>
      </div>

      {/* Statistiques et actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
          <div className="text-gray-400 text-sm mb-1">Total</div>
          <div className="text-2xl font-bold text-white">{notifications.length}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
          <div className="text-gray-400 text-sm mb-1">Non lues</div>
          <div className="text-2xl font-bold text-blue-400">{unreadCount}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
          <div className="text-gray-400 text-sm mb-1">Lues</div>
          <div className="text-2xl font-bold text-green-400">{readCount}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10 flex items-center justify-center">
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                Tout marquer lu
              </button>
            )}
            {readCount > 0 && (
              <button
                onClick={deleteAllRead}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer lues
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Filtres:</span>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'unread' | 'read')}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes</option>
            <option value="unread">Non lues</option>
            <option value="read">Lues</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les types</option>
            <option value="info">Info</option>
            <option value="success">Succès</option>
            <option value="warning">Avertissement</option>
            <option value="error">Erreur</option>
            <option value="invoice">Facture</option>
            <option value="client">Client</option>
            <option value="payment">Paiement</option>
            <option value="subscription">Abonnement</option>
            <option value="system">Système</option>
          </select>
        </div>
      </div>

      {/* Liste des notifications */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Chargement...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-12 border border-white/10 text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 text-gray-500 opacity-50" />
          <p className="text-gray-400 text-lg">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10 hover:bg-white/10 transition-all ${
                !notification.read ? 'bg-blue-500/10 border-blue-500/30' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                    !notification.read ? 'bg-blue-500' : 'bg-transparent'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-lg font-semibold text-white">{notification.title}</h3>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-gray-400 hover:text-green-400 transition-colors"
                          title="Marquer comme lu"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-300 mb-3">{notification.message}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(
                        notification.type
                      )}`}
                    >
                      {notification.type}
                    </span>
                    {notification.link_url && (
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {notification.link_text || 'Voir'}
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {notification.read && notification.read_at && (
                      <span className="text-xs text-gray-500">
                        Lu le {new Date(notification.read_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

