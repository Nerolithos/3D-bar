export function getInitialScene(pathname) {
  if (pathname === '/hr3' || pathname === '/hr3/') return 'horror-after-pool'
  return pathname === '/hr2' || pathname === '/hr2/' ? 'horror' : 'bar'
}
