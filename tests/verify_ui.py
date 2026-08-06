import os
from playwright.sync_api import sync_playwright

# Portability helper: dynamically resolve verification path
BASE_VERIFICATION_DIR = "/home/jules/verification" if os.path.exists("/home/jules") else os.path.abspath("./verification")
SCREENSHOTS_DIR = os.path.join(BASE_VERIFICATION_DIR, "screenshots")
VIDEOS_DIR = os.path.join(BASE_VERIFICATION_DIR, "videos")

def run_cuj(page):
    # Create verification folders
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000) # Let page load completely

    # Click on Analysis nav tab
    page.click("#nav-analysis")
    page.wait_for_timeout(1000)

    # Click on Archives nav tab
    page.click("#nav-archives")
    page.wait_for_timeout(1000)

    # Click on Databases nav tab
    page.click("#nav-databases")
    page.wait_for_timeout(1000)

    # Click back to Exploration
    page.click("#nav-exploration")
    page.wait_for_timeout(1000)

    # Take screenshot of the Exploration view showing the pristine, redesigned SideNavBar and TopBar!
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "verification.png"))
    page.wait_for_timeout(1000) # Hold final state for the video

if __name__ == "__main__":
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=VIDEOS_DIR
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
