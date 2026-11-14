export function UserAvatar({name='You',assistant=false}) {
  const initials = name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
  return <span aria-label={assistant?'KAMAL assistant':`${name} avatar`} className={`kamal-avatar ${assistant?'kamal-avatar-assistant':''}`}>
    {assistant ? <img src="/kamal-logo.svg" alt="" width="28" height="28"/> : initials}
  </span>;
}
