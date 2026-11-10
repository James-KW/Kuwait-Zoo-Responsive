// Ensure the mobile report controls stay below the fixed admin header on narrow screens.
// This is separate from the report's desktop layout and keeps its existing toggle behavior.
const style = document.createElement('style');
style.id = 'mobileReportLayoutFix';
style.textContent = `
  @media (max-width: 700px) {
    body { padding-top: 46px !important; }
    #adminHeader { z-index: 1000; }
    .mobile-controls {
      display: flex !important;
      position: relative;
      z-index: 20;
      width: 100%;
      min-height: 38px;
      align-items: center;
      justify-content: space-between;
    }
    .side-panel {
      display: flex;
      position: static;
      width: 100%;
      height: auto;
      max-height: none;
      overflow: visible;
      box-shadow: none;
      border-bottom: 1px solid #ddd;
      padding: 12px;
    }
    .side-panel:not(.open) { display: none !important; }
    .side-panel.open { display: flex !important; }
    .main-content-area {
      margin: 0 !important;
      min-height: 0;
      padding: 14px 8px 30px;
      overflow: visible;
    }
    .edit-status { left: 8px; right: 8px; }
  }
`;
document.head.append(style);
