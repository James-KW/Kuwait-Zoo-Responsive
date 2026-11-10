// Keep the desktop sidebar-and-report layout on narrow screens too.
// This intentionally enables horizontal scrolling instead of stacking the report.
const style = document.createElement('style');
style.id = 'mobileReportLayoutFix';
style.textContent = `
  @media (max-width: 700px) {
    body {
      min-width: 1000px !important;
      overflow-x: auto;
    }
    #adminHeader {
      position: fixed;
      top: 0;
      left: 0;
      right: auto;
      width: 1000px;
      min-width: 1000px;
      height: 46px;
      z-index: 1000;
    }
    .mobile-controls { display: none !important; }
    .side-panel {
      display: flex !important;
      position: fixed !important;
      left: 0 !important;
      top: 46px !important;
      bottom: 0 !important;
      width: 250px !important;
      height: calc(100vh - 46px) !important;
      max-height: none !important;
      overflow-y: auto !important;
      padding: 20px !important;
      box-shadow: 2px 0 10px #0000001a !important;
      border: 0 !important;
      z-index: 900;
    }
    .main-content-area {
      display: flex !important;
      position: relative;
      margin: 46px 0 0 250px !important;
      width: 750px;
      min-width: 750px;
      min-height: calc(100vh - 46px) !important;
      padding: 40px 20px !important;
      overflow: visible !important;
    }
    .page-stage {
      position: relative !important;
      flex: none !important;
      width: calc(21cm * .85) !important;
      height: calc(29.7cm * .85) !important;
    }
    #capture {
      position: absolute !important;
      width: 21cm !important;
      min-height: 29.7cm !important;
      transform: scale(.85) !important;
      transform-origin: top left !important;
    }
    .document-content { grid-template-columns: 1.5fr 1fr !important; }
    .edit-status { left: 270px !important; right: 20px !important; }
  }
`;
document.head.append(style);
