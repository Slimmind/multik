import { useState, useEffect } from 'react'

export default function useInit() {
  const [clientId, setClientId] = useState('')
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const [isRPi, setIsRPi] = useState(false)
  const [systemInfoLoaded, setSystemInfoLoaded] = useState(false)

  useEffect(() => {
    // Client ID initialization
    let storedId = localStorage.getItem('multik_client_id')
    if (!storedId) {
      storedId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('multik_client_id', storedId)
    }
    setClientId(storedId)

    // Theme initialization
    const savedTheme = localStorage.getItem('theme')
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemDark)

    if (shouldBeDark) {
      setIsDarkTheme(true)
      document.body.classList.add('dark-mode')
    } else {
      setIsDarkTheme(false)
      document.body.classList.remove('dark-mode')
    }

    // Check system info
    fetch('/system-info')
      .then(res => res.json())
      .then(data => {
        setIsRPi(data.isRPi)
      })
      .catch(err => console.error('Failed to fetch system info:', err))
      .finally(() => setSystemInfoLoaded(true))

  }, [])

  const toggleTheme = () => {
    const newDark = !isDarkTheme
    setIsDarkTheme(newDark)
    document.body.classList.toggle('dark-mode', newDark)
    localStorage.setItem('theme', newDark ? 'dark' : 'light')
  }

  return { clientId, isDarkTheme, toggleTheme, isRPi, systemInfoLoaded }
}
