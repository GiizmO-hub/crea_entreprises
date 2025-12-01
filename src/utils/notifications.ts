/**
 * Utilitaires pour créer et gérer les notifications
 */

import { supabase } from '../lib/supabase';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'invoice' | 'client' | 'payment' | 'subscription' | 'system';

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  link_url?: string;
  link_text?: string;
  metadata?: any;
  expires_at?: string;
}

/**
 * Créer une notification pour un utilisateur
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    console.log('🔔 [Notifications] Création notification pour user_id:', params.user_id, 'type:', params.type);
    
    const notificationData = {
      user_id: params.user_id,
      title: params.title,
      message: params.message,
      type: params.type || 'info',
      link_url: params.link_url,
      link_text: params.link_text,
      metadata: params.metadata || {},
      expires_at: params.expires_at,
      read: false, // Explicitement définir read à false
    };

    console.log('🔔 [Notifications] Données notification:', JSON.stringify(notificationData, null, 2));

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error('❌ [Notifications] Erreur insertion:', error);
      throw error;
    }

    console.log('✅ [Notifications] Notification créée avec succès:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [Notifications] Erreur création notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
}

/**
 * Créer une notification de facture
 */
export async function createInvoiceNotification(
  user_id: string,
  invoiceNumber: string,
  invoiceId: string,
  action: 'created' | 'paid' | 'overdue' | 'reminder'
) {
  const messages = {
    created: `Nouvelle facture ${invoiceNumber} créée`,
    paid: `Facture ${invoiceNumber} payée`,
    overdue: `Facture ${invoiceNumber} en retard`,
    reminder: `Rappel: Facture ${invoiceNumber} à payer`,
  };

  const types: Record<string, NotificationType> = {
    created: 'invoice',
    paid: 'success',
    overdue: 'error',
    reminder: 'warning',
  };

  return createNotification({
    user_id,
    title: messages[action],
    message: messages[action],
    type: types[action],
    link_url: `#factures`,
    link_text: 'Voir la facture',
    metadata: { invoice_id: invoiceId, invoice_number: invoiceNumber },
  });
}

/**
 * Créer une notification de client
 */
export async function createClientNotification(
  user_id: string,
  clientName: string,
  clientId: string,
  action: 'created' | 'updated' | 'deleted'
) {
  const messages = {
    created: `Nouveau client ajouté: ${clientName}`,
    updated: `Client mis à jour: ${clientName}`,
    deleted: `Client supprimé: ${clientName}`,
  };

  return createNotification({
    user_id,
    title: messages[action],
    message: messages[action],
    type: 'client',
    link_url: `#clients`,
    link_text: 'Voir les clients',
    metadata: { client_id: clientId },
  });
}

/**
 * Créer une notification de paiement
 */
export async function createPaymentNotification(
  user_id: string,
  amount: number,
  invoiceNumber: string
) {
  return createNotification({
    user_id,
    title: `Paiement reçu: ${amount.toFixed(2)}€`,
    message: `Paiement reçu pour la facture ${invoiceNumber}`,
    type: 'payment',
    link_url: `#factures`,
    link_text: 'Voir les factures',
    metadata: { amount, invoice_number: invoiceNumber },
  });
}

/**
 * Créer une notification système
 */
export async function createSystemNotification(
  user_id: string,
  title: string,
  message: string,
  metadata?: any
) {
  return createNotification({
    user_id,
    title,
    message,
    type: 'system',
    metadata,
  });
}

