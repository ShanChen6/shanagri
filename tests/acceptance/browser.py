"""Run on the isolated acceptance stack after api.mjs."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3000"
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    owner = browser.new_page()
    owner.on("dialog", lambda dialog: dialog.accept())
    owner.goto(BASE + "/chu-trang-trai/don")
    owner.get_by_label("Mã truy cập chủ trang trại").fill(os.environ["DEMO_OWNER_TOKEN"])
    owner.get_by_role("button", name="Xem danh sách").click()
    owner.get_by_label("Tên lô").fill("Lô nghiệm thu UI")
    owner.get_by_label("Vùng trồng").select_option("zone-cam")
    owner.get_by_label("Ngày bắt đầu").fill("2026-04-01")
    owner.get_by_label("Dự kiến thu hoạch").fill("2026-04-30")
    owner.get_by_text("Lưu lô nháp", exact=True).click()
    draft = owner.locator("li").filter(has_text="Lô nghiệm thu UI")
    draft.get_by_label("Giá (₫/kg)").fill("37000")
    draft.get_by_label("Hạn mức (kg)").fill("100")
    draft.get_by_text("Xem lại và mở bán").click()
    expect(draft).to_have_count(0)
    buyers = []
    for kg in [30, 25, 25]:
        buyer = browser.new_page()
        buyer.goto(BASE + "/cho-nong-san")
        buyer.locator("article").filter(has_text="Lô nghiệm thu UI").get_by_role("link", name="Đặt trước").click()
        buyer.get_by_label("Số kg").fill(str(kg))
        buyer.get_by_role("button", name="Giữ chỗ").click()
        link = buyer.get_by_role("link", name="Tra cứu đơn vừa đặt")
        expect(link).to_be_visible()
        code = buyer.url.split("/lo/")[1].split("#")[0]
        link.click()
        expect(buyer.get_by_text("Trạng thái: Chờ xác nhận")).to_be_visible()
        buyers.append(buyer)
    owner.get_by_role("button", name="Xem danh sách").click()
    for index in range(len(buyers)):
        owner.get_by_role("button", name="Xác nhận", exact=True).first.click()
        expect(owner.get_by_role("button", name="Xác nhận", exact=True)).to_have_count(2-index)
    lot = owner.locator("section").filter(has=owner.get_by_label("Ngày thực thu")).filter(has_text=code)
    lot.get_by_label("Ngày thực thu").fill("2026-04-30")
    lot.get_by_label("Sản lượng thực thu").fill("65")
    lot.get_by_role("button", name="Chốt thu hoạch").click()
    owner.get_by_role("button", name="Xem trước phân bổ").last.wait_for()
    # Select the intended lot even if several harvested lots exist.
    panel = owner.locator("section").filter(has_text=code).filter(has=owner.get_by_text("Xem đơn đang giữ", exact=True))
    panel.get_by_role("button", name="Xem trước phân bổ").click()
    expect(panel.get_by_role("spinbutton")).to_have_count(0)
    panel.get_by_role("button", name="Chốt phân bổ").click()
    expect(panel.get_by_text("Phân bổ đã chốt", exact=False)).to_be_visible()
    for buyer, ordered, assigned in zip(buyers,[30,25,25],[30,25,10]):
        buyer.reload()
        expect(buyer.get_by_text(f"Đã đặt: {ordered} kg · Được phân bổ: {assigned} kg")).to_be_visible()
    # Both independent tabs initially saw 35 kg on the February fixture.
    first, late = browser.new_page(), browser.new_page()
    for tab in (first, late):
        tab.goto(BASE + "/lo/CAM-2026-02")
        expect(tab.get_by_label("Số kg")).to_have_attribute("max", "35")
        tab.get_by_label("Số kg").fill("25")
    first.get_by_role("button", name="Giữ chỗ").click()
    expect(first.get_by_role("link", name="Tra cứu đơn vừa đặt")).to_be_visible()
    # The next poll can already have prevented submission client-side.
    submit = late.get_by_role("button", name="Giữ chỗ")
    if submit.is_enabled():
        submit.evaluate("(button) => button.click()")
    expect(late.get_by_label("Số kg")).to_have_attribute("max", "10", timeout=20000)
    expect(late.get_by_label("Số kg")).to_have_value("25")
    expect(late.get_by_role("link", name="Tra cứu đơn vừa đặt")).to_have_count(0)
    late.get_by_label("Số kg").fill("10")
    submit.click()
    expect(late.get_by_role("link", name="Tra cứu đơn vừa đặt")).to_be_visible()
    browser.close()
