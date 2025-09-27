import { NextRequest, NextResponse } from 'next/server';

// Force dynamic route since we need to access request headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const remoteAddress = request.ip;

    // Parse forwarded header to get the first IP
    let clientIp = '127.0.0.1'; // fallback for development

    if (forwarded) {
      clientIp = forwarded.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp;
    } else if (remoteAddress) {
      clientIp = remoteAddress;
    }

    // Get other client information
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const acceptLanguage = request.headers.get('accept-language') || 'Unknown';

    return NextResponse.json({
      ip: clientIp,
      userAgent,
      acceptLanguage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting client info:', error);

    return NextResponse.json(
      {
        error: 'Failed to get client information',
        ip: '127.0.0.1', // fallback
        userAgent: 'Unknown',
        acceptLanguage: 'Unknown',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}