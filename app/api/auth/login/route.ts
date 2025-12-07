
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Find existing user or create a new one (Upsert)
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {}, // No updates needed on login
      create: {
        walletAddress,
        totalPoints: 0,
        rank: 'Novice Scout',
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
