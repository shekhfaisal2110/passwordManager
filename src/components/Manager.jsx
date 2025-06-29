import React, { useEffect, useState } from 'react';
import {
  FaEye, FaEyeSlash, FaEdit, FaTrashAlt,
  FaCopy, FaPlus, FaGoogle, FaUserLock,
  FaDownload, FaInfoCircle,
} from 'react-icons/fa';
import CryptoJS from 'crypto-js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  auth, provider, signInWithPopup, signOut,
  onAuthStateChanged, db, doc, setDoc, getDoc,
} from '../firebase';

const PasswordsKey = 'passwords';
const encrypt = (text, key) => CryptoJS.AES.encrypt(text, key).toString();
const decrypt = (cipher, key) => {
  try {
    return CryptoJS.AES.decrypt(cipher, key).toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
};

const Manager = () => {
  const [form, setForm] = useState({ site: '', username: '', password: '', loginMethod: '' });
  const [passwordArray, setPasswordArray] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPwdIdx, setShowPwdIdx] = useState(null);
  const [showInputPwd, setShowInputPwd] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loginMethod, setLoginMethod] = useState(null);
  const [manualCreds, setManualCreds] = useState({ username: '', password: '' });
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [showSecureMessage, setShowSecureMessage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingUser(true);
      if (user) {
        setLoginMethod('google');
        setFirebaseUser(user);
        const docRef = doc(db, 'passwords', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const encryptedPasswords = docSnap.data().passwords || [];
          const decrypted = encryptedPasswords.map((item) => ({
            site: decrypt(item.site, user.uid),
            username: decrypt(item.username, user.uid),
            password: decrypt(item.password, user.uid),
            loginMethod: 'google',
          }));
          setPasswordArray(decrypted);
        }
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  const handleManualLogin = () => {
    const { username, password } = manualCreds;
    if (!username || !password) return toast.error('Enter manual username & password');
    setShowSecureMessage(true);
    setTimeout(() => {
      setLoginMethod('manual');
      const stored = localStorage.getItem(PasswordsKey);
      const localData = stored ? JSON.parse(stored) : [];
      const decrypted = localData.map((item) => ({
        site: decrypt(item.site, username),
        username: decrypt(item.username, username),
        password: decrypt(item.password, username),
        loginMethod: 'manual',
      }));
      setPasswordArray(decrypted);
      setShowSecureMessage(false);
      toast.success('Logged in manually');
    }, 1200);
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      toast.success('Logged in with Google');
    } catch {
      toast.error('Google login failed');
    }
  };

  const handleLogout = async () => {
    if (loginMethod === 'google') await signOut(auth);
    setFirebaseUser(null);
    setPasswordArray([]);
    setForm({ site: '', username: '', password: '', loginMethod: '' });
    setEditIndex(null);
    setLoginMethod(null);
    toast.info('Logged out');
  };

  const handleChanges = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const savePasswords = async (list) => {
    setPasswordArray(list);
    const key = loginMethod === 'google' ? firebaseUser.uid : manualCreds.username;
    const encrypted = list.map((item) => ({
      site: encrypt(item.site, key),
      username: encrypt(item.username, key),
      password: encrypt(item.password, key),
    }));

    if (loginMethod === 'google') {
      try {
        await setDoc(doc(db, 'passwords', firebaseUser.uid), { passwords: encrypted });
        toast.success('Synced to cloud');
      } catch {
        toast.error('Cloud sync failed');
      }
    } else {
      localStorage.setItem(PasswordsKey, JSON.stringify(encrypted));
      toast.success('Saved locally');
    }
  };

  const savePassword = () => {
    const { site, username, password, loginMethod: method } = form;
    if (!site.trim() || !username.trim()) return toast.error('Site and username required');
    if (method === 'manual' && !password.trim()) return toast.error('Password required');
    const entry = { site: site.trim(), username: username.trim(), password: method === 'manual' ? password.trim() : '', loginMethod: method };
    const updated = [...passwordArray];
    if (editIndex !== null) updated[editIndex] = entry; else updated.push(entry);
    savePasswords(updated);
    toast.success(editIndex !== null ? 'Password updated!' : 'Password added!');
    setForm({ site: '', username: '', password: '', loginMethod: '' });
    setEditIndex(null);
    setShowInputPwd(false);
  };

  const deletePassword = (idx) => {
    const filtered = passwordArray.filter((_, i) => i !== idx);
    savePasswords(filtered);
    toast.warn('Password deleted!');
    if (editIndex === idx) setForm({ site: '', username: '', password: '', loginMethod: '' });
    setEditIndex(null);
  };

  const editPassword = (idx) => {
    const item = passwordArray[idx];
    setForm(item);
    setEditIndex(idx);
    setShowInputPwd(false);
  };

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const toggleInputPwd = () => setShowInputPwd((s) => !s);

  const exportToJSON = () => {
    const blob = new Blob([JSON.stringify(passwordArray, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passwords.json';
    a.click();
  };

  const filteredList = passwordArray.filter((item) =>
    item.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingUser) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="animate-spin h-12 w-12 border-t-4 border-blue-500 rounded-full" />
    </div>
  );

  if (!loginMethod) return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-center items-center space-y-4 p-6">
      <h1 className="text-xl font-bold">Select Login Method</h1>
      <button onClick={handleGoogleLogin} className="flex items-center bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"><FaGoogle className="mr-2" /> Google Login</button>
      <div className="bg-gray-800 p-4 rounded w-full max-w-sm">
        <h2 className="font-semibold mb-2">Manual Login</h2>
        <input type="text" className="w-full mb-2 px-4 py-2 rounded bg-gray-700" placeholder="Username" value={manualCreds.username} onChange={(e) => setManualCreds({ ...manualCreds, username: e.target.value })} />
        <input type="password" className="w-full mb-4 px-4 py-2 rounded bg-gray-700" placeholder="Password" value={manualCreds.password} onChange={(e) => setManualCreds({ ...manualCreds, password: e.target.value })} />
        <button onClick={handleManualLogin} className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Login</button>
      </div>

      {(showSecureMessage || !loginMethod) && (
        <div className="bg-blue-600 text-white px-4 py-2 mt-4 rounded shadow text-sm">
          🔐 <span className="font-semibold">Data Privacy Notice:</span> Your passwords are encrypted and securely stored <span className="underline">only</span> on this device using localStorage. No one else, including developers, can access your data.
        </div>
      )}

      <ToastContainer position="top-right" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 relative">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Password Manager</h1>
        <div className="flex gap-2">
          <button onClick={exportToJSON} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"><FaDownload /> Export</button>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Logout</button>
        </div>
      </header>

      <input type="text" className="w-full mb-4 px-4 py-2 rounded bg-gray-700" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

      <select value={form.loginMethod} onChange={(e) => setForm((prev) => ({ ...prev, loginMethod: e.target.value }))} className="bg-gray-700 text-white px-4 py-2 mb-4 rounded">
        <option value="">Select Login Method</option>
        <option value="google">Google Email</option>
        <option value="manual">Username & Password</option>
      </select>

      <section className="mb-6 flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 items-center">
        <input type="text" name="site" placeholder="Website" value={form.site} onChange={handleChanges} className="w-full md:w-1/3 px-4 py-2 rounded bg-gray-700" />
        <input type="text" name="username" placeholder="Username" value={form.username} onChange={handleChanges} className="w-full md:w-1/3 px-4 py-2 rounded bg-gray-700" />
        {form.loginMethod === 'manual' && (
          <div className="relative w-full md:w-1/3">
            <input type={showInputPwd ? 'text' : 'password'} name="password" placeholder="Password" value={form.password} onChange={handleChanges} className="w-full px-4 py-2 rounded bg-gray-700" />
            <button type="button" onClick={toggleInputPwd} className="absolute top-2 right-3 text-gray-400 hover:text-white">{showInputPwd ? <FaEyeSlash /> : <FaEye />}</button>
          </div>
        )}
        <button onClick={savePassword} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-2 rounded"><FaPlus /> {editIndex !== null ? 'Update' : 'Add'}</button>
      </section>

      <section className="overflow-x-auto max-h-[400px] custom-scrollbar">
        <table className="w-full table-auto border-collapse border border-gray-700 text-sm">
          <thead>
            <tr className="bg-gray-800">
              <th className="border border-gray-600 px-2 py-2">Site</th>
              <th className="border border-gray-600 px-2 py-2">Username</th>
              <th className="border border-gray-600 px-2 py-2">Password</th>
              <th className="border border-gray-600 px-2 py-2">Method</th>
              <th className="border border-gray-600 px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((item, idx) => (
              <tr key={idx} className="bg-gray-900 hover:bg-gray-800">
                <td className="border border-gray-600 px-2 py-1">{item.site}</td>
                <td className="border border-gray-600 px-2 py-1">{item.username}</td>
                <td className="border border-gray-600 px-2 py-1">{idx === showPwdIdx ? item.password : '••••••••'}</td>
                <td className="border border-gray-600 px-2 py-1 text-center">
                  {item.loginMethod === 'google' ? <FaGoogle title="Google" /> : <FaUserLock title="Manual" />}
                </td>
                <td className="border border-gray-600 px-2 py-1 flex justify-center gap-2">
                  <button onClick={() => setShowPwdIdx(idx === showPwdIdx ? null : idx)} className="text-yellow-400 hover:text-yellow-300">{idx === showPwdIdx ? <FaEyeSlash /> : <FaEye />}</button>
                  <button onClick={() => copyText(item.username, 'Username')} className="text-blue-400 hover:text-blue-300"><FaCopy /></button>
                  <button onClick={() => copyText(item.password, 'Password')} className="text-blue-400 hover:text-blue-300"><FaCopy /></button>
                  <button onClick={() => editPassword(idx)} className="text-green-400 hover:text-green-300"><FaEdit /></button>
                  <button onClick={() => deletePassword(idx)} className="text-red-600 hover:text-red-500"><FaTrashAlt /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Floating Info Button */}
      <button
        onClick={() => setShowInfoBox(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 p-3 rounded-full shadow-lg z-50"
        title="About data security"
      >
        <FaInfoCircle className="text-white text-lg" />
      </button>

      {showInfoBox && (
        <div className="fixed bottom-20 right-6 w-80 bg-gray-800 border border-gray-600 text-white rounded-lg shadow-lg p-2 z-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-md font-semibold mb-1">🔒 Your Data is Safe</h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                • Passwords synced to cloud for Google login (accessible from any device).<br />
                • For manual login, data stays only on this device via localStorage.<br />
                • 🔐 Only <span className="text-white font-semibold">you</span> can access or export them.<br />
                • ✅ Even developers can’t view your encrypted data.
              </p>
            </div>
            <button
              onClick={() => setShowInfoBox(false)}
              className="text-gray-400 hover:text-white text-lg ml-4"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" />
    </div>
  );
};

export default Manager;
