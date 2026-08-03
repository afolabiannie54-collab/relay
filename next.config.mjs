/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions default to a 1MB request body limit — uploadMedia()
  // itself allows images/audio up to 10MB and files up to 50MB, but
  // without this, anything over 1MB (a routine phone photo) never even
  // reached that validation: the framework rejected the request first,
  // and since the client-side call had no try/catch, that failure
  // surfaced as an infinite "Sending..." hang rather than an error.
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      // Google OAuth profile photos.
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Supabase Storage public URLs — uploaded avatars and group photos.
      // Wildcarded rather than hardcoding the project ref so this doesn't
      // need updating if the project ever changes.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
