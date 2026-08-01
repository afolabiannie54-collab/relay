/** @type {import('next').NextConfig} */
const nextConfig = {
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
