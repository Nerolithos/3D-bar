export function getInitialScene(pathname) {
  return pathname === '/hr2' || pathname === '/hr2/' ? 'horror' : 'bar'
}