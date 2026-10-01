SerpAPI: Free Plan, 33 used this month, 217 left
TypeError: fetch failed
    at node:internal/deps/undici/undici:14976:13
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async json (file:///opt/gh-runners/skail-directory-crawler/_work/skail-directory-crawler/skail-directory-crawler/scripts/crawl.mjs:25:13)
    at async main (file:///opt/gh-runners/skail-directory-crawler/_work/skail-directory-crawler/skail-directory-crawler/scripts/crawl.mjs:108:20) {
  [cause]: Error: getaddrinfo ENOTFOUND skail.skylite.group
      at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26) {
    errno: -3007,
    code: 'ENOTFOUND',
    syscall: 'getaddrinfo',
    hostname: 'skail.skylite.group'
  }
}
