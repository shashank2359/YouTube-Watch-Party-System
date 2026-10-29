// Roles and authorization helpers. Every privileged socket event goes through these.
export const ROLES = Object.freeze({
  HOST: 'host',
  MODERATOR: 'moderator',
  PARTICIPANT: 'participant',
});

// Roles a host may assign through assign_role. "host" is deliberately absent:
// the only way to become host is transfer_host (or automatic succession).
export const ASSIGNABLE_ROLES = Object.freeze([ROLES.MODERATOR, ROLES.PARTICIPANT]);

export const isRoomMember = (room, userId) => room.participants.has(userId);
export const isHost = (participant) => participant?.role === ROLES.HOST;
export const canControlPlayback = (participant) =>
  participant?.role === ROLES.HOST || participant?.role === ROLES.MODERATOR;
export const canManageParticipants = (participant) => isHost(participant);
