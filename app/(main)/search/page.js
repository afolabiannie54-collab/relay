'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import { searchUsers } from '@/actions/users'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState(null)
  const searchTimeout = useRef(null)

  const handleSearch = (e) => {
    const value = e.target.value
    setQuery(value)
    setError(null)

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (value.trim().length < 3) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    searchTimeout.current = setTimeout(async () => {
      const result = await searchUsers(value.trim())
      if (result.error) {
        setError(result.error)
        setResults([])
      } else {
        setResults(result.data || [])
        setSearched(true)
      }
      setLoading(false)
    }, 400)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top nav */}
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <Link href="/chat" style={{
            textDecoration: 'none',
            color: '#0a0a0a',
            fontSize: '14px',
            fontWeight: '600',
            flexShrink: 0,
          }}>
            ←
          </Link>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by username..."
              value={query}
              onChange={handleSearch}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                background: '#F5F5F5',
                color: '#0a0a0a',
              }}
            />
            <span style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#A3A3A3',
              fontSize: '14px',
              pointerEvents: 'none',
            }}>
              🔍
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px 24px' }}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#A3A3A3', fontSize: '14px' }}>
            Searching...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#EF4444',
          }}>
            {error}
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>No users found</p>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              No one matches "{query}". Try a different username.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !searched && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>Find people on Relay</p>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              Search by username to find and message people.
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: '#A3A3A3', marginBottom: '4px', fontWeight: '600' }}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            {results.map(user => (
              <Link
                key={user.id}
                href={`/u/${user.username}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '3px 3px 0 #0a0a0a'
                    e.currentTarget.style.transform = 'translate(-1px, -1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translate(0, 0)'
                  }}
                >
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name}
                    size={48}
                  />
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a', marginBottom: '2px' }}>
                      {user.display_name}
                    </p>
                    <p style={{ fontSize: '13px', color: '#A3A3A3' }}>@{user.username}</p>
                  </div>
                  <div style={{ marginLeft: 'auto', color: '#A3A3A3', fontSize: '16px' }}>→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}