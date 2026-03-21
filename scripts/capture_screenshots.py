"""
Capture README screenshots using Playwright.

Assumes the demo backend is already running on port 8002 with the frontend build served.
Start it with:
    scripts/update_screenshots.sh   (orchestrates everything)

Or manually:
    backend/.venv/bin/pip install playwright
    backend/.venv/bin/playwright install chromium
    backend/.venv/bin/python3 scripts/capture_screenshots.py

Screenshots are saved to docs/screenshots/.
"""

import asyncio
import os
from pathlib import Path

BASE_URL = os.environ.get("PAGEHOUND_URL", "http://localhost:8002")
OUT_DIR = Path(__file__).parent.parent / "docs" / "screenshots"
VIEWPORT = {"width": 1440, "height": 900}

# Each page: name, path, wait_for text (after app is ready), optional action
PAGES = [
    {
        "name": "library",
        "path": "/",
        "wait_for": "Elena Vasquez",
        "description": "Library — book grid with toolbar",
    },
    {
        "name": "library-list",
        "path": "/",
        "wait_for": "Elena Vasquez",
        "description": "Library — list view",
        "action": "list_view",
    },
    {
        "name": "review-queue",
        "path": "/review",
        "wait_for": "Cold Harbour",
        "description": "Metadata review queue — per-field checkboxes",
    },
    {
        "name": "search",
        "path": "/search",
        "wait_for": "Search",
        "description": "Search page",
    },
    {
        "name": "settings",
        "path": "/settings",
        "wait_for": "Library",
        "description": "Settings page",
    },
    {
        "name": "kobo",
        "path": "/kobo",
        "wait_for": "Kobo",
        "description": "Kobo sync page",
    },
]


async def capture() -> None:
    from playwright.async_api import async_playwright

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport=VIEWPORT,
            color_scheme="dark",
        )
        page = await context.new_page()

        # Load the app once to warm up (React hydrates on first load)
        print("  Warming up app...")
        await page.goto(BASE_URL)
        # Wait for the sidebar to appear — means React has mounted
        try:
            await page.get_by_text("PageHound", exact=False).first.wait_for(
                state="visible", timeout=20_000
            )
        except Exception:
            print("  Warning: PageHound sidebar text not found — app may not have loaded")
        await asyncio.sleep(4.0)

        for spec in PAGES:
            url = f"{BASE_URL}{spec['path']}"
            print(f"  {spec['name']}: {url}")

            await page.goto(url)

            # Wait for React app sidebar to appear
            try:
                await page.get_by_text("PageHound", exact=False).first.wait_for(
                    state="visible", timeout=15_000
                )
            except Exception:
                pass

            # Wait for page-specific content
            try:
                await page.get_by_text(spec["wait_for"], exact=False).first.wait_for(
                    state="visible", timeout=15_000
                )
            except Exception:
                print(f"    Warning: '{spec['wait_for']}' not found — screenshot may be incomplete")

            # Perform any page-specific actions
            if spec.get("action") == "list_view":
                try:
                    await page.get_by_label("List view").click()
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

            # Settle time for images and animations
            await asyncio.sleep(3.0)

            out_path = OUT_DIR / f"{spec['name']}.png"
            await page.screenshot(path=str(out_path), full_page=False)
            print(f"    -> {out_path}")

        await browser.close()

    print(f"\nDone. {len(PAGES)} screenshots saved to {OUT_DIR}/")


if __name__ == "__main__":
    asyncio.run(capture())
