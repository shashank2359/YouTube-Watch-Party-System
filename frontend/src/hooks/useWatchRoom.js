import { useCallback, useEffect, useRef, useState } from 'react';
import { socket, emitAck, sessions } from '../services/socket.js';

/**
 * All room state lives here. The server is the source of truth: this hook only
 * mirrors what the server sends and forwards the user's intentions as events.
 */
export function useWatchRoom(roomId, initialUsername) {
  const [connection, setConnection] = useState(socket.connected ? 'connected' : 'connecting');
  const [status, setStatus] = useState('idle'); // idle | joining | joined | error | removed | replaced
  const [error, setError] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [participants, setParticipants] = useState([]);
  const [me, setMe] = useState(null);
  const [requests, setRequests] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [playback, setPlayback] = useState(null);
  const [toasts, setToasts] = useState([]);

  const joinedRef = useRef(false);
  const meRef = useRef(null);
  const versionRef = useRef(-1);
  const toastId = useRef(0);

  const pushToast = useCallback((type, message) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const applySnapshot = useCallback((res) => {
    const { room } = res;
    meRef.current = { userId: res.userId, username: res.username };
    setMe({ userId: res.userId, username: res.username, role: res.role });
    setRoomName(room.name);
    setParticipants(room.participants);
    setRequests(room.pendingRequests);
    setChatMessages(room.chatMessages ?? []);
    versionRef.current = room.state.version;
    setPlayback({ ...room.state, receivedAt: Date.now() });
  }, []);

  const join = useCallback(async (username) => {
    setStatus('joining');
    setError(null);
    const saved = sessions.get(roomId);
    const res = await emitAck('join_room', {
      roomId,
      username: username ?? saved?.username,
      sessionToken: saved?.sessionToken,
    });
    if (res.ok) {
      sessions.set(roomId, { userId: res.userId, sessionToken: res.sessionToken, username: res.username });
      joinedRef.current = true;
      applySnapshot(res);
      setStatus('joined');
      return res;
    }
    const { code, message } = res.error;
    setError(message);
    if (code === 'USERNAME_TAKEN' || code === 'INVALID_USERNAME') setStatus('idle');
    else if (code === 'OFFLINE' || code === 'TIMEOUT') setStatus(joinedRef.current ? 'joined' : 'idle');
    else {
      sessions.clear(roomId);
      joinedRef.current = false;
      setStatus('error');
    }
    return res;
  }, [roomId, applySnapshot]);

  const joinRef = useRef(join);
  joinRef.current = join;

  useEffect(() => {
    const onConnect = () => {
      setConnection('connected');
      const saved = sessions.get(roomId);
      if (saved || initialUsername || joinedRef.current) joinRef.current(saved?.username ?? initialUsername);
    };
    const onDisconnect = () => setConnection('reconnecting');
    const onConnectError = () => setConnection(joinedRef.current ? 'reconnecting' : 'offline');

    const onSync = (s) => {
      if (s.version < versionRef.current) return; // late / out-of-order update
      versionRef.current = s.version;
      setPlayback({ ...s, receivedAt: Date.now() });
    };
    const onParticipants = ({ participants: list }) => setParticipants(list);
    const onChatMessage = (message) => setChatMessages((list) => [...list.filter((m) => m.id !== message.id), message].slice(-80));
    const roleOf = (list) => list.find((p) => p.userId === meRef.current?.userId)?.role;

    const onJoined = (p) => { setParticipants(p.participants); pushToast('info', `${p.username} joined`); };
    const onLeft = (p) => {
      setParticipants(p.participants);
      if (p.userId !== meRef.current?.userId) pushToast('info', `${p.username} left`);
    };
    const onRole = (p) => {
      setParticipants(p.participants);
      const mine = roleOf(p.participants);
      if (mine) setMe((m) => (m ? { ...m, role: mine } : m));
      if (p.userId === meRef.current?.userId) pushToast('success', `You are now a ${p.role}`);
      else pushToast('info', `${p.username} is now a ${p.role}`);
    };
    const onHost = (p) => {
      setParticipants(p.participants);
      const mine = roleOf(p.participants);
      if (mine) setMe((m) => (m ? { ...m, role: mine } : m));
      pushToast('info', p.userId === meRef.current?.userId ? 'You are now the host' : `${p.username} is now the host`);
    };
    const onRemoved = (p) => {
      if (p.userId === meRef.current?.userId) {
        sessions.clear(roomId);
        joinedRef.current = false;
        setStatus('removed');
      } else {
        setParticipants(p.participants);
        pushToast('info', `${p.username} was removed`);
      }
    };
    const onRequest = (r) => { setRequests((list) => [...list.filter((x) => x.id !== r.id), r]); pushToast('info', `${r.username} requested: ${r.action.replace('_', ' ')}`); };
    const onResolved = (r) => {
      setRequests((list) => list.filter((x) => x.id !== r.requestId));
      if (r.userId === meRef.current?.userId) {
        pushToast(r.approved ? 'success' : 'error', r.approved ? `${r.reviewer} approved your request` : `${r.reviewer} declined your request`);
      }
    };
    const onReplaced = () => { joinedRef.current = false; setStatus('replaced'); };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('sync_state', onSync);
    socket.on('chat_message', onChatMessage);
    socket.on('participants_updated', onParticipants);
    socket.on('user_joined', onJoined);
    socket.on('user_left', onLeft);
    socket.on('role_assigned', onRole);
    socket.on('host_transferred', onHost);
    socket.on('participant_removed', onRemoved);
    socket.on('playback_request_received', onRequest);
    socket.on('playback_request_resolved', onResolved);
    socket.on('session_replaced', onReplaced);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('sync_state', onSync);
      socket.off('chat_message', onChatMessage);
      socket.off('participants_updated', onParticipants);
      socket.off('user_joined', onJoined);
      socket.off('user_left', onLeft);
      socket.off('role_assigned', onRole);
      socket.off('host_transferred', onHost);
      socket.off('participant_removed', onRemoved);
      socket.off('playback_request_received', onRequest);
      socket.off('playback_request_resolved', onResolved);
      socket.off('session_replaced', onReplaced);
    };
  }, [roomId, initialUsername, pushToast]);

  const canControl = me?.role === 'host' || me?.role === 'moderator';
  const isHost = me?.role === 'host';

  /** Host/moderator: direct command. Participant: becomes a request that needs approval. */
  const act = useCallback(async (action, data = {}) => {
    const direct = canControl;
    const res = await emitAck(direct ? action : 'request_playback', direct ? data : { action, ...data });
    if (!res.ok) pushToast('error', res.error.message);
    else if (!direct) {
      setRequests((list) => [...list.filter((x) => x.id !== res.request.id), res.request]);
      pushToast('success', 'Request sent — waiting for approval');
    }
    return res;
  }, [canControl, pushToast]);

  const manage = useCallback(async (event, payload, okMessage) => {
    const res = await emitAck(event, payload);
    if (!res.ok) pushToast('error', res.error.message);
    else if (okMessage) pushToast('success', okMessage);
    return res;
  }, [pushToast]);

  const assignRole = (userId, role) => manage('assign_role', { userId, role });
  const removeParticipant = (userId) => manage('remove_participant', { userId });
  const transferHost = (userId) => manage('transfer_host', { userId });
  const resolveRequest = (requestId, approve) => manage('resolve_request', { requestId, approve });
  const sendChatMessage = useCallback(async (text) => {
    const res = await emitAck('send_chat_message', { text });
    if (!res.ok) pushToast('error', res.error.message);
    return res;
  }, [pushToast]);

  const leave = useCallback(async () => {
    await emitAck('leave_room', { roomId });
    sessions.clear(roomId);
    joinedRef.current = false;
  }, [roomId]);

  const visibleRequests = canControl ? requests : requests.filter((r) => r.userId === me?.userId);

  return {
    connection, status, error, roomName, participants, me, canControl, isHost, playback, toasts,
    requests: visibleRequests, chatMessages, sendChatMessage, join, act, assignRole, removeParticipant, transferHost, resolveRequest,
    leave, pushToast, dismissToast,
  };
}
