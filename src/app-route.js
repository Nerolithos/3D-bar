export function getInitialScene(pathname) {
  if (pathname === '/yog' || pathname === '/yog/') return 'library-after-survival'
  if (pathname === '/hr3' || pathname === '/hr3/') return 'horror-after-pool'
  return pathname === '/hr2' || pathname === '/hr2/' ? 'horror' : 'bar'
}
