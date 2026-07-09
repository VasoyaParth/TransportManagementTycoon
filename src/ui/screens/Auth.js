// Cloud auth gate — Login / Register. Shown when there is no valid session.
// On success the app loads the player's cloud game state.
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { C, FONT } from '../theme';
import { useAuth } from '../../store/authStore';
import { haptic } from '../../engine/haptics';

export default function Auth() {
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localErr, setLocalErr] = useState(null);
  const busy = useAuth(s => s.busy);
  const error = useAuth(s => s.error);
  const login = useAuth(s => s.login);
  const register = useAuth(s => s.register);

  const isReg = mode === 'register';

  const submit = async () => {
    setLocalErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setLocalErr('Enter a valid email address.'); return; }
    if (password.length < 6) { setLocalErr('Password must be at least 6 characters.'); return; }
    haptic('medium');
    const r = isReg ? await register(email, password, name) : await login(email, password);
    if (!r.ok) haptic('warn');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <View style={st.badge}><Icon name="truck-fast" size={40} color="#fff" /></View>
        <Text style={[FONT.h1, { marginTop: 16 }]}>Truck Empire Tycoon</Text>
        <Text style={[FONT.sub, { marginTop: 4, marginBottom: 24 }]}>
          {isReg ? 'Create an account to sync across devices' : 'Log in to your empire'}
        </Text>

        {isReg && (
          <>
            <Text style={st.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={C.faint}
              autoCapitalize="words" style={st.input} />
          </>
        )}
        <Text style={st.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.faint}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={st.input} />
        <Text style={st.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={C.faint}
          secureTextEntry autoCapitalize="none" style={st.input} />

        {(localErr || error) && (
          <View style={st.errBox}>
            <Icon name="alert-circle" size={15} color={C.red} />
            <Text style={[FONT.tiny, { color: C.red, marginLeft: 6, flex: 1 }]}>{localErr || error}</Text>
          </View>
        )}

        <Pressable style={[st.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" />
            : <Text style={st.btnTxt}>{isReg ? 'Create Account' : 'Log In'}</Text>}
        </Pressable>

        <Pressable style={{ marginTop: 18 }} onPress={() => { haptic('light'); setLocalErr(null); setMode(isReg ? 'login' : 'register'); }}>
          <Text style={{ color: C.blue, fontWeight: '700' }}>
            {isReg ? 'Already have an account? Log in' : "New here? Create an account"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  badge: { width: 76, height: 76, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  label: { ...FONT.tiny, alignSelf: 'flex-start', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginTop: 12 },
  input: {
    width: '100%', borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, backgroundColor: '#fff',
  },
  errBox: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: C.redSoft, borderRadius: 12, padding: 10, width: '100%' },
  btn: { width: '100%', marginTop: 22, backgroundColor: C.blue, borderRadius: 26, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
