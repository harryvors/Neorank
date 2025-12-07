
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cafes = await prisma.cafe.findMany({
      include: {
        reviews: {
          take: 5, // Include 5 most recent reviews for preview
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { walletAddress: true, rank: true } // Don't expose sensitive user data
            }
          }
        }
      }
    });

    return NextResponse.json(cafes);
  } catch (error) {
    console.error('Fetch cafes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
