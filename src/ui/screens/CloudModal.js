// Cloud account panel — shows the signed-in user, a Logout action, and a
// server-backed city list demonstrating lazy loading / infinite scroll
// (pages come from GET /api/config/cities?cursor=...).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { C, FONT, RADIUS } from '../theme';
import { Sheet, Card, Btn, Row, Icon, useToast } from '../components';
import { useAuth } from '../../store/authStore';
import { api } from '../../net/api';
import { haptic } from '../../engine/haptics';

export function CloudModal({ visible, onClose }) {
  const toast = useToast();
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);

  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const loadMore = useCallback(async (reset = false) => {
    if (loading) return;
    if (done && !reset) return;
    setLoading(true); setErr(null);
    try {
      const cur = reset ? '' : cursor;
      const { items: page, nextCursor } = await api.config('cities', cur, 20);
      setItems(prev => (reset ? page : [...prev, ...page]));
      setCursor(nextCursor == null ? '' : String(nextCursor));
      setDone(nextCursor == null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [loading, done, cursor]);

  // (Re)load the first page whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setItems([]); setCursor(''); setDone(false); setErr(null);
    loadMore(true);
  }, [visible]);

  const doLogout = async () => {
    haptic('warn');
    await logout();
    onClose();
    toast('Logged out', 'info');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Cloud Account" height="86%">
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
        <Row style={{ marginTop: 10 }}>
          <Icon name="cloud-check" size={14} color={C.green} />
          <Text style={[FONT.tiny, { marginLeft: 6, color: C.sub, flex: 1 }]}>
            Your empire auto-syncs to the cloud — log in on any device to continue.
          </Text>
        </Row>
      </Card>

      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={FONT.h3}>Cities Directory</Text>
        <Text style={FONT.tiny}>{items.length} loaded</Text>
      </Row>

      <FlatList
        data={items}
        keyExtractor={(it, i) => `${it.name || 'c'}-${i}`}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={() => loadMore(false)}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 6, padding: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Icon name="map-marker" size={16} color={C.blue} />
                <Text style={[FONT.body, { marginLeft: 8, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
              </Row>
              {item.tier != null && <Text style={FONT.tiny}>Tier {item.tier}</Text>}
            </Row>
          </Card>
        )}
        ListFooterComponent={
          err ? (
            <Pressable onPress={() => loadMore(false)} style={st.footer}>
              <Icon name="alert-circle-outline" size={16} color={C.red} />
              <Text style={{ color: C.red, marginLeft: 6, fontWeight: '700' }}>{err} · Tap to retry</Text>
            </Pressable>
          ) : loading ? (
            <View style={st.footer}><ActivityIndicator color={C.blue} /></View>
          ) : done && items.length > 0 ? (
            <Text style={[FONT.tiny, { textAlign: 'center', paddingVertical: 14 }]}>— end of list —</Text>
          ) : !loading && items.length === 0 ? (
            <Text style={[FONT.sub, { textAlign: 'center', paddingVertical: 20 }]}>No cloud data yet. Seed the server (`npm run seed`).</Text>
          ) : null
        }
      />
    </Sheet>
  );
}

const st = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
});
