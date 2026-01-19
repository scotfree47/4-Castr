import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle financial API requests - inject API keys server-side
  if (pathname.startsWith('/api/financial')) {
    const requestHeaders = new Headers(request.headers);
    
    // Financial data API keys
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      requestHeaders.set('X-Alpha-Vantage-Key', process.env.ALPHA_VANTAGE_API_KEY);
    }
    if (process.env.POLYGON_API_KEY) {
      requestHeaders.set('X-Polygon-Key', process.env.POLYGON_API_KEY);
    }
    if (process.env.COINGECKO_API_KEY) {
      requestHeaders.set('X-CoinGecko-Key', process.env.COINGECKO_API_KEY);
    }
    if (process.env.COINMARKETCAP_API_KEY) {
      requestHeaders.set('X-CMC-Key', process.env.COINMARKETCAP_API_KEY);
    }
    if (process.env.EXCHANGERATE_API_KEY) {
      requestHeaders.set('X-ExchangeRate-Key', process.env.EXCHANGERATE_API_KEY);
    }
    if (process.env.FMP_API_KEY) {
      requestHeaders.set('X-FMP-Key', process.env.FMP_API_KEY);
    }
    if (process.env.OANDA_API_KEY) {
      requestHeaders.set('X-Oanda-Key', process.env.OANDA_API_KEY);
    }
    if (process.env.OANDA_ACCOUNT_ID) {
      requestHeaders.set('X-Oanda-Account', process.env.OANDA_ACCOUNT_ID);
    }
    if (process.env.OANDA_ENVIRONMENT) {
      requestHeaders.set('X-Oanda-Environment', process.env.OANDA_ENVIRONMENT);
    }
    if (process.env.TWELVE_API_KEY) {
      requestHeaders.set('X-Twelve-Key', process.env.TWELVE_API_KEY);
    }
    if (process.env.QUIVER_API_KEY) {
      requestHeaders.set('X-Quiver-Key', process.env.QUIVER_API_KEY);
    }
    if (process.env.QUANDL_API_KEY) {
      requestHeaders.set('X-Quandl-Key', process.env.QUANDL_API_KEY);
    }
    if (process.env.NASDAQ_DATA_LINK_API_KEY) {
      requestHeaders.set('X-Nasdaq-Key', process.env.NASDAQ_DATA_LINK_API_KEY);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Handle Astro API requests
  if (pathname.startsWith('/api/astro')) {
    const requestHeaders = new Headers(request.headers);
    
    if (process.env.PROKERALA_API_KEY) {
      requestHeaders.set('X-Prokerala-Key', process.env.PROKERALA_API_KEY);
    }
    if (process.env.FREEASTRO_API_KEY) {
      requestHeaders.set('X-FreeAstro-Key', process.env.FREEASTRO_API_KEY);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Handle AI API requests
  if (pathname.startsWith('/api/ai')) {
    const requestHeaders = new Headers(request.headers);
    
    if (process.env.ANTHROPIC_API_KEY) {
      requestHeaders.set('X-Anthropic-Key', process.env.ANTHROPIC_API_KEY);
    }
    if (process.env.OPENAI_API_KEY) {
      requestHeaders.set('X-OpenAI-Key', process.env.OPENAI_API_KEY);
    }
    if (process.env.COHERE_API_KEY) {
      requestHeaders.set('X-Cohere-Key', process.env.COHERE_API_KEY);
    }
    if (process.env.DEEPSEEK_API_KEY) {
      requestHeaders.set('X-DeepSeek-Key', process.env.DEEPSEEK_API_KEY);
    }
    if (process.env.GEMINI_API_KEY) {
      requestHeaders.set('X-Gemini-Key', process.env.GEMINI_API_KEY);
    }
    if (process.env.GROK_API_KEY) {
      requestHeaders.set('X-Grok-Key', process.env.GROK_API_KEY);
    }
    if (process.env.GROQ_API_KEY) {
      requestHeaders.set('X-Groq-Key', process.env.GROQ_API_KEY);
    }
    if (process.env.META_API_KEY) {
      requestHeaders.set('X-Meta-Key', process.env.META_API_KEY);
    }
    if (process.env.MISTRAL_API_KEY) {
      requestHeaders.set('X-Mistral-Key', process.env.MISTRAL_API_KEY);
    }
    if (process.env.MOONSHOT_API_KEY) {
      requestHeaders.set('X-Moonshot-Key', process.env.MOONSHOT_API_KEY);
    }
    if (process.env.OPENROUTER_API_KEY) {
      requestHeaders.set('X-OpenRouter-Key', process.env.OPENROUTER_API_KEY);
    }
    if (process.env.SMITHERY_API_KEY) {
      requestHeaders.set('X-Smithery-Key', process.env.SMITHERY_API_KEY);
    }
    if (process.env.QWEN_API_KEY) {
      requestHeaders.set('X-Qwen-Key', process.env.QWEN_API_KEY);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Redirect /login to /auth/sign-in
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url))
  }

  // Redirect /register to /auth/sign-up
  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/auth/sign-up', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/financial/:path*',
    '/api/astro/:path*',
    '/api/ai/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}