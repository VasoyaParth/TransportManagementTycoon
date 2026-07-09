// Cloud account + backup panel. Shows the signed-in user, when the game last
// backed up to the cloud, and exactly WHAT is synced (with live counts), plus
// a "Sync now" action and Logout.
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, FONT } from '../theme';
import { Sheet, Card, Btn, Row, Icon, useToast, relTime } from '../components';
import { useAuth } from '../../store/authStore';
import { useSync } from '../../store/syncStore';
import { useGame } from '../../store/gameStore';
import { inrShort } from '../../engine/economy';
import { haptic } from '../../engine/haptics';

export function CloudModal({ visible, onClose }) {
  const toast = useToast();
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);

  const status = useSync(s => s.status);
  const lastSyncedAt = useSync(s => s.lastSyncedAt);
  const flush = useSync(s => s.flush);

  const g = useGame();

  const doLogout = async () => {
    haptic('warn');
    await logout();
    onClose();
    toast('Logged out', 'info');
  };

  const syncNow = () => { haptic('light'); flush(); toast('Backing up to cloud…', 'info'); };

  // What gets backed up — live counts straight from the game state.
  const items = [
    { icon: 'domain', label: 'Company profile', value: g.company?.name || '—' },
    { icon: 'cash', label: 'Balance (money)', value: inrShort(g.balance || 0) },
    { icon: 'gold', label: 'Gold', value: String(g.gold || 0) },
    { icon: 'truck', label: 'Trucks owned', value: (g.trucks || []).length },
    { icon: 'account-group', label: 'Staff & drivers', value: (g.staff || []).length },
    { icon: 'garage', label: 'Hubs & garages', value: (g.hubs || []).length },
    { icon: 'map-marker-path', label: 'Explored routes', value: (g.corridors || []).length },
    { icon: 'truck-fast', label: 'Active deliveries', value: (g.deliveries || []).length },
    { icon: 'history', label: 'Delivery history', value: (g.history || []).length },
    { icon: 'file-document-outline', label: 'Contracts', value: (g.contracts || []).length },
    { icon: 'bell-outline', label: 'Notifications', value: (g.notifications || []).length },
    { icon: 'cog-outline', label: 'Settings & preferences', value: 'Saved' },
  ];

  const meta = status === 'syncing' ? { icon: 'cloud-sync', color: C.blue, text: 'Backing up…' }
    : status === 'error' ? { icon: 'cloud-alert', color: C.red, text: 'Last backup failed — will retry' }
      : lastSyncedAt ? { icon: 'cloud-check', color: C.green, text: `Backed up ${relTime(lastSyncedAt)}` }
        : { icon: 'cloud-outline', color: C.sub, text: 'Waiting for first backup…' };

  return (
    <Sheet visible={visible} onClose={onClose} title="Cloud Backup" height="86%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Account */}
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <View style={st.avatar}><Icon name="account-circle" size={26} color={C.blue} /></View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[FONT.body, { fontWeight: '800' }]} numberOfLines={1}>{user?.name || 'Player'}</Text>
                <Text style={FONT.tiny} numberOfLines={1}>{user?.email}</Text>
              </View>
            </Row>
            <Btn title="Logout" kind="danger" small icon="logout" onPress={doLogout} />
          </Row>
        </Card>

        {/* Backup status */}
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <Icon name={meta.icon} size={22} color={meta.color} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[FONT.body, { fontWeight: '800', color: meta.color }]}>{meta.text}</Text>
                <Text style={FONT.tiny}>Auto-syncs on every change and when you leave the app.</Text>
              </View>
            </Row>
            <Btn title="Sync now" kind="soft" small icon="cloud-upload-outline" onPress={syncNow} />
          </Row>
        </Card>

        <Text style={[FONT.tiny, { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginLeft: 2 }]}>
          What's backed up to the cloud
        </Text>
        <Card style={{ paddingVertical: 4 }}>
          {items.map((it, i) => (
            <Row key={it.label} style={[{ justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 }, i > 0 && st.divider]}>
              <Row style={{ flex: 1 }}>
                <Icon name={it.icon} size={17} color={C.sub} />
                <Text style={[FONT.body, { marginLeft: 10 }]}>{it.label}</Text>
              </Row>
              <Row>
                <Text style={[FONT.body, { fontWeight: '800', marginRight: 8 }]} numberOfLines={1}>{String(it.value)}</Text>
                <Icon name="check-circle" size={15} color={C.green} />
              </Row>
            </Row>
          ))}
        </Card>

        <Row style={{ marginTop: 12, paddingHorizontal: 4 }}>
          <Icon name="shield-check" size={14} color={C.green} />
          <Text style={[FONT.tiny, { marginLeft: 6, color: C.sub, flex: 1 }]}>
            Everything above is stored on your cloud account. Log in on any device to restore it exactly.
          </Text>
        </Row>
      </ScrollView>
    </Sheet>
  );
}

const st = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: C.border },
});
