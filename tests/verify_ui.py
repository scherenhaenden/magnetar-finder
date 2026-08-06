import os
import argparse
from playwright.sync_api import sync_playwright

# Portability helper: dynamically resolve verification path
BASE_VERIFICATION_DIR = "/home/jules/verification" if os.path.exists("/home/jules") else os.path.abspath("./verification")
SCREENSHOTS_DIR = os.path.join(BASE_VERIFICATION_DIR, "screenshots")
VIDEOS_DIR = os.path.join(BASE_VERIFICATION_DIR, "videos")

def run_cuj(page, base_url):
    # Create verification folders
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    page.goto(base_url, wait_until="networkidle")
    page.locator("#view-exploration").wait_for(state="visible")

    # Click on Analysis nav tab
    page.click("#nav-analysis")
    page.locator("#view-analysis").wait_for(state="visible")

    # Click on Archives nav tab
    page.click("#nav-archives")
    page.locator("#view-archives").wait_for(state="visible")

    # Click on Databases nav tab
    page.click("#nav-databases")
    page.locator("#view-databases").wait_for(state="visible")

    # Click back to Exploration
    page.click("#nav-exploration")
    page.locator("#view-exploration").wait_for(state="visible")

    # Take screenshot of the Exploration view showing the pristine, redesigned SideNavBar and TopBar!
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "verification.png"))
    page.wait_for_timeout(1000) # Hold final state for the video

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("MAGNETAR_BASE_URL", "http://127.0.0.1:7474"))
    args = parser.parse_args()
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None,
        )
        context = browser.new_context(
            record_video_dir=VIDEOS_DIR
        )
        page = context.new_page()
        try:
            run_cuj(page, args.base_url)
        finally:
            context.close()
            browser.close()
