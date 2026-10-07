import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { generateSalt, deriveMasterKey, encryptData, decryptData } from './lib/cryptoUtils';
import { Lock, Key, Plus, Trash2, Eye, EyeOff, LogOut, Copy, Check } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hint, setHint] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  
  const [masterKey, setMasterKey] = useState(null);
  const [items, setItems] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [visiblePasswordId, setVisiblePasswordId] = useState(null);

  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [itemPassword, setItemPassword] = useState('');
  const [siteUrl, setSiteUrl] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && masterKey) fetchVaultItems();
  }, [session, masterKey]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const salt = await generateSalt();
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
          await supabase.from('user_profiles').insert([{ id: data.user.id, salt, password_hint: hint }]);
          const derivedKey = await deriveMasterKey(password, salt);
          setMasterKey(derivedKey);
        }
      } else {
        const { data: salt, error: saltErr } = await supabase.rpc('get_salt_by_email', { email_input: email });
        if (saltErr || !salt) throw new Error('找不到該帳號或鹽值');

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const derivedKey = await deriveMasterKey(password, salt);
        setMasterKey(derivedKey);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchVaultItems = async () => {
    const { data, error } = await supabase.from('vault_items').select('*').eq('is_deleted', false);
    if (error) return console.error(error);

    const decryptedList = await Promise.all(
      data.map(async (item) => {
        try {
          const rawJson = await decryptData(masterKey, item.encrypted_payload, item.iv);
          return { id: item.id, ...JSON.parse(rawJson) };
        } catch {
          return { id: item.id, title: '解密失敗', username: '', password: '' };
        }
      })
    );
    setItems(decryptedList);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title || !itemPassword) return;

    const payload = JSON.stringify({ title, username, password: itemPassword, siteUrl });
    const { encryptedPayload, ivHex } = await encryptData(masterKey, payload);

    const { error } = await supabase.from('vault_items').insert([
      { user_id: session.user.id, encrypted_payload: encryptedPayload, iv: ivHex }
    ]);

    if (!error) {
      setTitle(''); setUsername(''); setItemPassword(''); setSiteUrl('');
      fetchVaultItems();
    }
  };

  const handleDeleteItem = async (id) => {
    await supabase.from('vault_items').update({ is_deleted: true }).eq('id', id);
    fetchVaultItems();
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!session || !masterKey) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
          <div className="flex justify-center mb-6 text-indigo-400">
            <Lock className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-6">{isRegister ? '建立金庫帳號' : '解鎖密碼金庫'}</h2>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="電子郵件" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500" />
            <input type="password" placeholder="主密碼 (Master Password)" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500" />
            {isRegister && <input type="text" placeholder="主密碼提示 (可選)" value={hint} onChange={e => setHint(e.target.value)} className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500" />}
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg transition">{isRegister ? '註冊並建立' : '解鎖金庫'}</button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full text-center text-sm text-slate-400 mt-4 hover:underline">{isRegister ? '已有帳號？點此登入' : '第一次使用？點此註冊'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xl"><Key /> 零知識密碼管理器</div>
          <button onClick={() => { setMasterKey(null); supabase.auth.signOut(); }} className="flex items-center gap-1 text-slate-400 hover:text-red-400 text-sm"><LogOut className="w-4 h-4"/> 登出金庫</button>
        </header>

        <form onSubmit={handleAddItem} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-400"/> 新增密碼項目</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="網站/服務名稱" value={title} onChange={e => setTitle(e.target.value)} required className="p-2.5 bg-slate-700 rounded-lg border border-slate-600" />
            <input type="text" placeholder="帳號 / Email" value={username} onChange={e => setUsername(e.target.value)} className="p-2.5 bg-slate-700 rounded-lg border border-slate-600" />
            <input type="password" placeholder="密碼" value={itemPassword} onChange={e => setItemPassword(e.target.value)} required className="p-2.5 bg-slate-700 rounded-lg border border-slate-600" />
            <input type="url" placeholder="網址 (可選)" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} className="p-2.5 bg-slate-700 rounded-lg border border-slate-600" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg">儲存並加密</button>
        </form>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-indigo-300">{item.title}</h4>
                <p className="text-sm text-slate-400">{item.username || '無帳號'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setVisiblePasswordId(visiblePasswordId === item.id ? null : item.id)} className="p-2 hover:bg-slate-700 rounded-lg">{visiblePasswordId === item.id ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                <button onClick={() => copyToClipboard(item.password, item.id)} className="p-2 hover:bg-slate-700 rounded-lg">{copiedId === item.id ? <Check className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4"/>}</button>
                <button onClick={() => handleDeleteItem(item.id)} className="p-2 hover:bg-slate-700 rounded-lg text-red-400"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
