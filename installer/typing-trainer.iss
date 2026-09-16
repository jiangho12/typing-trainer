; ============================================================
;  打字训练场 · Typing Trainer — Inno Setup 安装包脚本
;  编译： "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" installer\typing-trainer.iss
; ============================================================

#define AppName        "打字训练场"
#define AppVersion     "1.2.0"
#define AppPublisher   "CIOT 工作室"
#define AppURL         "https://github.com/jiangho12/typing-trainer"
#define AppExeName     "打字训练场.exe"
#define SourceExeName  "打字练习.exe"
#define SourceDir      "..\打字练习-win32-x64"

[Setup]
; AppId 保持固定，后续升级安装才能识别为同一个软件
AppId={{8F3A2C41-6B7E-4E29-9C55-1D2A7E9B4F10}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}/releases

DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes

; 允许用户选择「仅为当前用户安装」（免 UAC）或「为所有用户安装」
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

OutputDir=..\dist
OutputBaseFilename=TypingTrainer-Setup-{#AppVersion}
SetupIconFile=..\app\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName} {#AppVersion}

Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} 安装程序
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加快捷方式:"; Flags: checkedonce

[Files]
; 除主程序外的全部文件（Electron 运行时、locales、resources 等）
Source: "{#SourceDir}\*"; DestDir: "{app}"; \
  Excludes: "{#SourceExeName},debug.log"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

; 主程序：安装时改名为「打字训练场.exe」，与软件展示名保持一致
Source: "{#SourceDir}\{#SourceExeName}"; DestDir: "{app}"; DestName: "{#AppExeName}"; \
  Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\卸载 {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "立即启动 {#AppName}"; Flags: nowait postinstall skipifsilent
