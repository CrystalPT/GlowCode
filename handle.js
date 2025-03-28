let tabs = [];
let activeTab = null;
let showPreview = false;
let showTerminal = false;
let theme = 'dark';
let linkedFiles = {};
let pyodideInstance = null;
let pyodideLoading = false;
let codeEditorInstance = null;
let shareBtn;
let fileSizeIndicator, charCountIndicator, lastModifiedIndicator;
let searchPanel, searchInput, replaceInput, prevMatchBtn, nextMatchBtn, closeSearchBtn, replaceBtn, replaceAllBtn;
let currentSearchMarkers = [];
let currentSearchIndex = -1;

let userSettings = {
  theme: 'dark',
  accentColor: '#8b5cf6',
  fontSize: 14,
  tabSize: 2,
  lineWrap: false,
  lineNumbers: true,
  autosave: false,
  syntaxColors: {
    keyword: '#ff9d00',
    string: '#7ec699',
    variable: '#e06c75',
    number: '#7fcef5',
    comment: '#676e95',
    def: '#c792ea'
  }
};

const languages = [
  { id: 'javascript', name: 'JavaScript', color: '#f7df1e', extensions: ['.js', '.jsx', '.ts', '.tsx'], mime: 'text/javascript' },
  { id: 'python', name: 'Python', color: '#3572A5', extensions: ['.py'], mime: 'text/x-python' },
  { id: 'rust', name: 'Rust', color: '#dea584', extensions: ['.rs'], mime: 'text/x-rustsrc' },
  { id: 'go', name: 'Go', color: '#00ADD8', extensions: ['.go'], mime: 'text/x-go' },
  { id: 'html', name: 'HTML', color: '#e34c26', extensions: ['.html', '.htm'], mime: 'text/html' },
  { id: 'css', name: 'CSS', color: '#563d7c', extensions: ['.css'], mime: 'text/css' }
];

let tabsContainer, languageSelector, previewPanel, previewIframe, previewToggleBtn,
    terminalPanel, terminal, terminalToggleBtn, runCodeBtn, runCodeSidebarBtn,
    clearTerminalBtn, linkCssContainer, linkedCssInfo, linkCssBtn, cursorPosition,
    languageIndicator, fileCounter, toast, newFileBtn, newFileDropdown,
    languageOptions, openFileBtn, saveFileBtn, openFolderBtn, renameFileBtn,
    downloadProjectBtn, refreshPreviewBtn, themeToggleBtn, editorArea;

document.addEventListener('DOMContentLoaded', function() {
  tabsContainer = document.getElementById('tabs-container');
  languageSelector = document.getElementById('language-selector');
  previewPanel = document.getElementById('preview-panel');
  previewIframe = document.getElementById('preview-iframe');
  previewToggleBtn = document.getElementById('preview-toggle-btn');
  terminalPanel = document.getElementById('terminal-panel');
  terminal = document.getElementById('terminal');
  terminalToggleBtn = document.getElementById('terminal-toggle-btn');
  runCodeBtn = document.getElementById('run-code-btn');
  runCodeSidebarBtn = document.getElementById('run-code-sidebar-btn');
  clearTerminalBtn = document.getElementById('clear-terminal-btn');
  linkCssContainer = document.getElementById('link-css-container');
  linkedCssInfo = document.getElementById('linked-css-info');
  linkCssBtn = document.getElementById('link-css-btn');
  cursorPosition = document.getElementById('cursor-position');
  languageIndicator = document.getElementById('language-indicator');
  fileCounter = document.getElementById('file-counter');
  toast = document.getElementById('toast');
  newFileBtn = document.getElementById('new-file-btn');
  newFileDropdown = document.getElementById('new-file-dropdown');
  languageOptions = document.getElementById('language-options');
  openFileBtn = document.getElementById('open-file-btn');
  saveFileBtn = document.getElementById('save-file-btn');
  openFolderBtn = document.getElementById('open-folder-btn');
  renameFileBtn = document.getElementById('rename-file-btn');
  downloadProjectBtn = document.getElementById('download-project-btn');
  refreshPreviewBtn = document.getElementById('refresh-preview-btn');
  themeToggleBtn = document.getElementById('theme-toggle-btn');
  editorArea = document.getElementById('editor-area');
  shareBtn = document.getElementById('share-btn');
  fileSizeIndicator = document.getElementById('file-size');
  charCountIndicator = document.getElementById('char-count');
  lastModifiedIndicator = document.getElementById('last-modified');
  searchPanel = document.getElementById('search-panel');
  searchInput = document.getElementById('search-input');
  replaceInput = document.getElementById('replace-input');
  prevMatchBtn = document.getElementById('prev-match-btn');
  nextMatchBtn = document.getElementById('next-match-btn');
  closeSearchBtn = document.getElementById('close-search-btn');
  replaceBtn = document.getElementById('replace-btn');
  replaceAllBtn = document.getElementById('replace-all-btn');
  
  window.writeToTerminalFromPython = function(text) {
    writeToTerminal(text);
  };

  // Check if there's a shared workspace in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const sharedData = urlParams.get('share');
  if (sharedData) {
    loadSharedWorkspace(sharedData);
  }

  initEditor();
});

function initEditor() {
  if (!languageSelector) {
    console.error("Language selector not found");
    return;
  }
  
  const savedFiles = localStorage.getItem('codecrystal-saved-files');
  let hasRestoredFiles = false;

  const getIndentation = (cm, line) => {
    const lineContent = cm.getLine(line);
    const match = lineContent.match(/^\s*/);
    return match ? match[0] : '';
  };

  const handleHtmlCompletion = (cm) => {
    const cursor = cm.getCursor();
    const line = cursor.line;
    const content = cm.getLine(line);
    const cursorPos = cursor.ch;

    // Check if we just typed '>'
    if (content[cursorPos - 1] === '>') {
      const beforeCursor = content.slice(0, cursorPos);
      const tagMatch = beforeCursor.match(/<(\w+)([^>]*)>$/);
      
      if (tagMatch) {
        const [fullMatch, tagName, attributes] = tagMatch;
        
        // Skip self-closing tags
        const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
        if (selfClosingTags.includes(tagName.toLowerCase())) {
          return;
        }

        // Define inline elements that should stay on the same line
        const inlineElements = ['a', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'span', 'strong', 'em', 'label', 'i', 'b', 'small', 'code', 'time', 'mark'];
        
        if (inlineElements.includes(tagName.toLowerCase())) {
          // For inline elements, add closing tag on same line and place cursor between tags
          const closingTag = `</${tagName}>`;
          cm.replaceRange(closingTag, cursor);
          cm.setCursor({
            line: line,
            ch: cursorPos
          });
        } else {
          // For block elements, add closing tag on new line with proper indentation
          const currentIndent = getIndentation(cm, line);
          const extraIndent = ' '.repeat(userSettings.tabSize);
          
          const closingTag = `\n${currentIndent}${extraIndent}\n${currentIndent}</${tagName}>`;
          cm.replaceRange(closingTag, cursor);
          
          cm.setCursor({
            line: line + 1,
            ch: currentIndent.length + extraIndent.length
          });
        }
      }
    }
  };

  const editorConfig = {
    lineNumbers: true,
    theme: 'dracula',
    mode: 'javascript',
    indentUnit: userSettings.tabSize,
    tabSize: userSettings.tabSize,
    lineWrapping: false,
    autoCloseBrackets: true,
    matchBrackets: true,
    styleActiveLine: true,
    scrollbarStyle: "simple",
    indentWithTabs: false,
    viewportMargin: Infinity,
    extraKeys: {
      "Tab": function(cm) {
        const spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        cm.replaceSelection(spaces);
      }
    }
  };
  
  if (savedFiles) {
    try {
      const parsedFiles = JSON.parse(savedFiles);
      tabs = parsedFiles;
      if (tabs.length > 0) {
        hasRestoredFiles = true;
        renderTabs();
        const firstTab = tabs[0];
        activeTab = firstTab.id;
        codeEditorInstance = CodeMirror(document.getElementById('code-editor'), {
          ...editorConfig,
          mode: languages.find(l => l.id === firstTab.language)?.mime || 'javascript',
          value: firstTab.content
        });
        localStorage.removeItem('codecrystal-saved-files');
      }
    } catch (e) {
      console.error('Error restoring saved files:', e);
    }
  }
  
  if (!codeEditorInstance) {
    codeEditorInstance = CodeMirror(document.getElementById('code-editor'), editorConfig);
    
    if (!hasRestoredFiles) {
      const template = getTemplateForLanguage('javascript');
      codeEditorInstance.setValue(template);
      createNewTab('javascript');
    }
  }

  // Add HTML completion handler
  codeEditorInstance.on('inputRead', (cm, change) => {
    if (change.text.includes('>')) {
      const tab = tabs.find(t => t.id === activeTab);
      if (tab && tab.language === 'html') {
        handleHtmlCompletion(cm);
      }
    }
  });
  
  codeEditorInstance.setSize("100%", "100%");
  
  // Ensure proper viewport rendering
  const refreshEditor = () => {
    codeEditorInstance.refresh();
    const scrollElement = document.querySelector('.CodeMirror-scroll');
    if (scrollElement) {
      scrollElement.style.overflow = 'auto';
    }
  };

  // Initial refresh
  setTimeout(refreshEditor, 300);

  // Add refresh on window resize
  window.addEventListener('resize', refreshEditor);

  // Add refresh on tab changes
  const resizeObserver = new ResizeObserver(() => {
    refreshEditor();
  });
  resizeObserver.observe(document.getElementById('code-editor'));

  codeEditorInstance.on("cursorActivity", function() {
    const cursor = codeEditorInstance.getCursor();
    if (cursorPosition) {
      cursorPosition.textContent = `Line: ${cursor.line + 1}, Col: ${cursor.ch + 1}`;
    }
  });
  
  codeEditorInstance.on("change", function() {
    handleEditorInput();
  });
  
  languages.forEach(lang => {
    const langBtn = document.createElement('div');
    langBtn.className = 'language-badge';
    langBtn.style.backgroundColor = lang.color;
    langBtn.style.color = 'black';
    langBtn.textContent = lang.name;
    langBtn.dataset.language = lang.id;
    languageSelector.appendChild(langBtn);
    
    if (languageOptions) {
      const option = document.createElement('div');
      option.className = 'px-3 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm flex items-center';
      option.dataset.language = lang.id;
      
      const colorDot = document.createElement('div');
      colorDot.className = 'w-2 h-2 rounded-full mr-2';
      colorDot.style.backgroundColor = lang.color;
      
      option.appendChild(colorDot);
      option.appendChild(document.createTextNode(lang.name));
      languageOptions.appendChild(option);
    }
  });
  
  loadSettings();
  
  setupEventListeners();
}

async function runCode() {
  const tab = tabs.find(t => t.id === activeTab);
  if (!tab) return;
  
  if (!showTerminal && terminalPanel) {
    toggleTerminal();
  }
  
  clearTerminal();
  
  writeToTerminal(`Running ${tab.name}...`, 'terminal-success');
  
  if (tab.language === 'javascript') {
    try {
      const code = tab.content;
      const consoleMethods = {
        log: (...args) => writeToTerminal(args.join(' ')),
        warn: (...args) => writeToTerminal(args.join(' '), 'terminal-warning'),
        error: (...args) => writeToTerminal(args.join(' '), 'terminal-error'),
        info: (...args) => writeToTerminal(args.join(' '))
      };
      
      const runWithCustomConsole = new Function('console', code);
      
      runWithCustomConsole(consoleMethods);
      
      writeToTerminal('Code executed successfully', 'terminal-success');
    } catch (error) {
      writeToTerminal(`Error: ${error.message}`, 'terminal-error');
    }
  } else if (tab.language === 'python') {
    await runPythonCode(tab.content);
  } else {
    writeToTerminal(`Language '${tab.language}' execution is not supported in the browser.`, 'terminal-warning');
  }
}

async function saveFile() {
  const tab = tabs.find(t => t.id === activeTab);
  if (!tab) return;
  
  try {
    let fileHandle = tab.fileHandle;
    
    if (!fileHandle) {
      if (!('showSaveFilePicker' in window)) {
        showToast('File system access is not supported in this browser');
        downloadFile(tab);
        return;
      }
      
      const options = {
        suggestedName: tab.name,
        types: [
          {
            description: 'Text File',
            accept: { 'text/plain': [getFileExtensionForLanguage(tab.language)] }
          }
        ]
      };
      
      fileHandle = await window.showSaveFilePicker(options);
      tab.fileHandle = fileHandle;
      tab.name = fileHandle.name;
      tab.displayName = fileHandle.name;
    }
    
    const writable = await fileHandle.createWritable();
    await writable.write(tab.content);
    await writable.close();
    
    tab.isUnsaved = false;
    renderTabs();
    
    showToast(`Saved ${tab.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast(`Error saving file: ${err.message}`);
      console.error('Error saving file:', err);
      downloadFile(tab);
    }
  }
}

function renderTabs() {
  if (!tabsContainer) return;
  
  tabsContainer.innerHTML = '';
  
  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab ${tab.id === activeTab ? 'active' : ''}`;
    
    const badge = document.createElement('div');
    badge.className = 'file-badge';
    badge.style.backgroundColor = getLanguageColor(tab.language);
    tabElement.appendChild(badge);
    
    const nameContainer = document.createElement('div');
    nameContainer.className = 'tab-name-container';
    nameContainer.title = tab.path ? `${tab.path}/${tab.name}` : tab.name;
    
    if (tab.path) {
      const pathSpan = document.createElement('span');
      pathSpan.className = 'text-xs text-gray-500 mr-1';
      pathSpan.textContent = tab.path + '/';
      nameContainer.appendChild(pathSpan);
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = tab.displayName || tab.name;
    nameContainer.appendChild(nameSpan);
    
    if (tab.isUnsaved) {
      const unsavedDot = document.createElement('div');
      unsavedDot.className = 'unsaved-indicator ml-2';
      nameContainer.appendChild(unsavedDot);
    }
    
    tabElement.appendChild(nameContainer);
    
    const actions = document.createElement('div');
    actions.className = 'tab-actions';
    
    const renameBtn = document.createElement('button');
    renameBtn.className = 'tab-action-btn';
    renameBtn.innerHTML = '✎';
    renameBtn.title = 'Rename';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameFile(tab.id);
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-action-btn';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    
    actions.appendChild(renameBtn);
    actions.appendChild(closeBtn);
    tabElement.appendChild(actions);
    
    tabElement.addEventListener('click', () => setActiveTab(tab.id));
    
    tabsContainer.appendChild(tabElement);
  });
  
  if (fileCounter) {
    fileCounter.textContent = tabs.length > 0 ? `${tabs.length} files open` : 'No files open';
  }
}

function updatePreview(force = false) {
  if (!showPreview && !force) return;
  if (!previewPanel || !previewIframe) return;
  
  const tab = tabs.find(t => t.id === activeTab);
  if (!tab) return;
  
  if (tab.language === 'html') {
    const doc = previewIframe.contentDocument || previewIframe.contentWindow.document;

    let content = tab.content;

    const linkRegex = /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const cssFileName = match[1];
      const cssTab = tabs.find(t => t.name === cssFileName && t.language === 'css');
      
      if (cssTab) {
        const styleTag = `<style>/* ${cssFileName} */\n${cssTab.content}\n</style>`;

        const contentForPreview = content.replace(match[0], styleTag);
        
        if (contentForPreview !== content) {
          content = contentForPreview;

          linkRegex.lastIndex = 0;
        }
      }
    }
    
    doc.open();
    doc.write(content);
    doc.close();
  } else if (tab.language === 'css') {
    for (const htmlTabId in linkedFiles) {
      if (linkedFiles[htmlTabId] === tab.id) {
        const htmlTab = tabs.find(t => t.id === parseInt(htmlTabId));
        if (htmlTab && htmlTab.language === 'html') {
          updatePreview(true);
          break;
        }
      }
    }
  }
}

async function openFolder() {
  try {
    if (!('showDirectoryPicker' in window)) {
      showFolderAccessHelp();
      return;
    }
    
    const dirHandle = await window.showDirectoryPicker();

    let fileCount = 0;
    const maxFiles = 10; 
    
    showToast(`Opening files from folder: ${dirHandle.name}...`);
    
    async function* getFiles(dirHandle, path = '') {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          yield { handle: entry, path: path };
        } else if (entry.kind === 'directory') {
          const newPath = path ? `${path}/${entry.name}` : entry.name;
          yield* getFiles(entry, newPath);
        }
      }
    }
    
    for await (const file of getFiles(dirHandle)) {
      if (fileCount >= maxFiles) break;
      
      try {
        const fileHandle = file.handle;
        const fileObj = await fileHandle.getFile();
        
        // Only open text files
        const isTextFile = fileObj.name.match(/\.(js|py|html|css|txt|json|rs|go|md)$/i);
        if (!isTextFile) continue;
        
        const contents = await fileObj.text();
        
        const fileName = fileObj.name;
        const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
        let language = 'javascript';
        
        for (const lang of languages) {
          if (lang.extensions.includes(extension)) {
            language = lang.id;
            break;
          }
        }
        
        const id = Date.now() + fileCount;
        const tab = {
          id: id,
          name: fileObj.name,
          displayName: fileObj.name,
          path: file.path,
          language: language,
          content: contents,
          isUnsaved: false,
          fileHandle: fileHandle
        };
        
        tabs.push(tab);
        fileCount++;
      } catch (error) {
        console.error('Error loading file:', error);
      }
    }
    
    renderTabs();
    if (tabs.length > 0) {
      setActiveTab(tabs[tabs.length - 1].id);
    }
    
    if (fileCount > 0) {
      showToast(`Opened ${fileCount} files from ${dirHandle.name}`);
    } else {
      showToast(`No compatible text files found in ${dirHandle.name}`);
    }
    
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast(`Error opening folder: ${err.message}`);
      console.error('Error opening folder:', err);
    }
  }
}

function getLanguageColor(language) {
  return languages.find(l => l.id === language)?.color || '#ffffff';
}

function handleEditorInput() {
  const tab = tabs.find(t => t.id === activeTab);
  if (!tab) return;
  
  tab.content = codeEditorInstance.getValue();
  tab.isUnsaved = true;
  renderTabs();
  
  if (showPreview && (tab.language === 'html' || tab.language === 'css')) {
    updatePreview();
  }

  updateStatusIndicators();
}

function setActiveTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  
  activeTab = id;
  
  if (codeEditorInstance) {
    codeEditorInstance.setValue(tab.content);
    
    const langInfo = languages.find(l => l.id === tab.language);
    if (langInfo) {
      codeEditorInstance.setOption('mode', langInfo.mime);
    }
  }
  
  updateLanguageUI(tab.language);
  renderTabs();
  updateStatusIndicators();
  
  if (tab.language === 'html' && linkCssContainer) {
    linkCssContainer.classList.remove('hidden');
    updateLinkedCssInfo();
  } else if (linkCssContainer) {
    linkCssContainer.classList.add('hidden');
  }
  
  if (showPreview && (tab.language === 'html' || tab.language === 'css')) {
    updatePreview(true);
  } else if (showPreview && previewPanel && editorArea) {
    previewPanel.classList.add('hidden');
    editorArea.classList.remove('w-1/2');
    editorArea.classList.add('w-full');
  }
}

function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;
  
  const tab = tabs[index];
  
  if (tab.isUnsaved) {
    const confirm = window.confirm(`${tab.name} has unsaved changes. Do you want to close it anyway?`);
    if (!confirm) return;
  }

  if (tab.language === 'css') {
    for (const htmlTabId in linkedFiles) {
      if (linkedFiles[htmlTabId] === tab.id) {
        delete linkedFiles[htmlTabId];
      }
    }
  }

  if (tab.language === 'html') {
    for (const cssTabId in linkedFiles) {
      if (linkedFiles[cssTabId] === tab.id) {
        delete linkedFiles[cssTabId];
      }
    }
  }
  
  tabs.splice(index, 1);
  
  if (tabs.length === 0) {
    activeTab = null;
    if (codeEditorInstance) codeEditorInstance.setValue('');
  } else if (activeTab === id) {
    setActiveTab(tabs[Math.min(index, tabs.length - 1)].id);
  }
  
  renderTabs();
  
  if (tab.language === 'html' && linkCssContainer) {
    linkCssContainer.classList.add('hidden');
  }
}

async function openFile() {
  try {
    if (!('showOpenFilePicker' in window)) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js,.py,.html,.css,.txt,.json,.rs,.go';
      
      input.onchange = async (event) => {
        if (event.target.files.length > 0) {
          const file = event.target.files[0];
          const contents = await file.text();
          
          const fileName = file.name;
          const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
          let language = 'javascript';
          
          for (const lang of languages) {
            if (lang.extensions.includes(extension)) {
              language = lang.id;
              break;
            }
          }
          
          const id = Date.now();
          const tab = {
            id: id,
            name: file.name,
            displayName: file.name,
            language: language,
            content: contents,
            isUnsaved: false,
            fileHandle: null
          };
          
          tabs.push(tab);
          renderTabs();
          setActiveTab(id);
          
          showToast(`Opened ${file.name}`);
        }
      };
      
      input.click();
      return;
    }
    
    const options = {
      types: [
        {
          description: 'Text Files',
          accept: {
            'text/*': ['.js', '.py', '.html', '.css', '.txt', '.json', '.rs', '.go']
          }
        }
      ],
      multiple: false
    };
    
    const [fileHandle] = await window.showOpenFilePicker(options);
    const file = await fileHandle.getFile();
    const contents = await file.text();
    
    const fileName = file.name;
    const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    let language = 'javascript';
    
    for (const lang of languages) {
      if (lang.extensions.includes(extension)) {
        language = lang.id;
        break;
      }
    }
    
    const id = Date.now();
    const tab = {
      id: id,
      name: file.name,
      displayName: file.name,
      language: language,
      content: contents,
      isUnsaved: false,
      fileHandle: fileHandle
    };
    
    tabs.push(tab);
    renderTabs();
    setActiveTab(id);
    
    showToast(`Opened ${file.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast(`Error opening file: ${err.message}`);
      console.error('Error opening file:', err);
    }
  }
}

function downloadFile(tab) {
  if (!tab) {
    tab = tabs.find(t => t.id === activeTab);
    if (!tab) return;
  }
  
  const blob = new Blob([tab.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = tab.name;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${tab.name}`);
}

function downloadProject() {
  if (tabs.length === 0) {
    showToast('No files to download');
    return;
  }
  
  const zip = new JSZip();
  
  tabs.forEach(tab => {
    zip.file(tab.name, tab.content);
  });
  
  zip.generateAsync({ type: 'blob' }).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code-crystal-project.zip';
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Project downloaded as zip');
  }).catch(err => {
    showToast(`Error creating zip: ${err.message}`);
    console.error('Error creating zip:', err);
  });
}

function showToast(message) {
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function getFileExtensionForLanguage(language) {
  switch(language) {
    case 'javascript': return '.js';
    case 'python': return '.py';
    case 'rust': return '.rs';
    case 'go': return '.go';
    case 'html': return '.html';
    case 'css': return '.css';
    default: return '.txt';
  }
}

function getTemplateForLanguage(language) {
  switch(language) {
    case 'html':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  
</body>
</html>`;
    case 'css':
      return `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
}
`;
    case 'javascript':
      return `console.log('Hello, world!');

function init() {
}
`;
    case 'python':
      return `def main():
    print("Hello, world!")
    
    numbers = [1, 2, 3, 4, 5]
    squared = [n**2 for n in numbers]
    print(f"Original numbers: {numbers}")
    print(f"Squared numbers: {squared}")
    
    message = "Python in the browser!"
    print(f"Message: {message}")
    print(f"Uppercase: {message.upper()}")
    print(f"Character count: {len(message)}")

main()
`;
    case 'rust':
      return `fn main() {
    println!("Hello, world!");
}
`;
    case 'go':
      return `package main

import "fmt"

func main() {
    fmt.Println("Hello, world!")
}
`;
    default:
      return '';
  }
}

function updateLanguageUI(language) {
  if (!languageSelector || !languageIndicator) return;
  
  const allBadges = languageSelector.querySelectorAll('.language-badge');
  allBadges.forEach(badge => {
    if (badge.dataset.language === language) {
      badge.style.boxShadow = `0 0 8px ${getLanguageColor(language)}`;
      badge.style.fontWeight = 'bold';
    } else {
      badge.style.boxShadow = 'none';
      badge.style.fontWeight = 'normal';
    }
  });
  
  const color = getLanguageColor(language);
  languageIndicator.style.backgroundColor = color;
  languageIndicator.style.color = 'black';
  languageIndicator.style.boxShadow = `0 0 5px ${color}`;
  languageIndicator.textContent = languages.find(l => l.id === language)?.name || 'Unknown';
}

function createNewTab(language) {
  const id = Date.now();
  const extension = getFileExtensionForLanguage(language);
  const content = getTemplateForLanguage(language);
  
  const tab = {
    id: id,
    name: `untitled${extension}`,
    displayName: `untitled${extension}`,
    language: language,
    content: content,
    isUnsaved: true,
    fileHandle: null
  };
  
  tabs.push(tab);
  renderTabs();
  setActiveTab(id);
  showToast(`Created new ${languages.find(l => l.id === language).name} file`);
}

function toggleTheme() {
  // Simply toggle between dark and light themes
  userSettings.theme = userSettings.theme === 'dark' ? 'light' : 'dark';
  
  // Save settings and apply them
  saveSettings();
  applySettings();
  
  // Notify user of theme change
  showToast(`Theme changed to ${userSettings.theme}`);
}

function setupEventListeners() {
  if (newFileBtn) newFileBtn.addEventListener('click', toggleNewFileDropdown);
  if (openFileBtn) openFileBtn.addEventListener('click', openFile);
  if (saveFileBtn) saveFileBtn.addEventListener('click', saveFile);
  if (openFolderBtn) {
    if ('showDirectoryPicker' in window) {
      openFolderBtn.addEventListener('click', openFolder);
      openFolderBtn.title = "Open Folder";
    } else {
      openFolderBtn.addEventListener('click', showFolderAccessHelp);
      openFolderBtn.title = "Folder Access Help";
    }
  }
  if (renameFileBtn) renameFileBtn.addEventListener('click', () => renameFile(activeTab));
  if (downloadProjectBtn) downloadProjectBtn.addEventListener('click', downloadProject);
  if (refreshPreviewBtn) refreshPreviewBtn.addEventListener('click', () => updatePreview(true));
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (previewToggleBtn) previewToggleBtn.addEventListener('click', togglePreview);
  if (terminalToggleBtn) terminalToggleBtn.addEventListener('click', toggleTerminal);
  if (linkCssBtn) linkCssBtn.addEventListener('click', linkCssFile);
  if (runCodeBtn) runCodeBtn.addEventListener('click', runCode);
  if (runCodeSidebarBtn) runCodeSidebarBtn.addEventListener('click', runCode);
  if (clearTerminalBtn) clearTerminalBtn.addEventListener('click', clearTerminal);
  if (shareBtn) shareBtn.addEventListener('click', shareWorkspace);
  
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  const resetColorsBtn = document.getElementById('reset-colors-btn');
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      if (settingsModal) {
        settingsModal.classList.remove('hidden');
        loadSettingsToForm();
      }
    });
  }
  
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', function() {
      if (settingsModal) settingsModal.classList.add('hidden');
    });
  }
  
  if (settingsModal) {
    const settingsBackdrop = document.getElementById('settings-backdrop');
    if (settingsBackdrop) {
      settingsBackdrop.addEventListener('click', function() {
        settingsModal.classList.add('hidden');
      });
    }
  }
  
  if (settingsTabBtns) {
    settingsTabBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const tabName = btn.dataset.tab;
        
        settingsTabBtns.forEach(b => {
          b.classList.remove('text-blue-400', 'border-b-2', 'border-blue-400');
          b.classList.add('text-gray-400');
        });
        btn.classList.remove('text-gray-400');
        btn.classList.add('text-blue-400', 'border-b-2', 'border-blue-400');
        
        document.querySelectorAll('.settings-tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        document.getElementById(`${tabName}-settings`).classList.remove('hidden');
      });
    });
  }
  
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.theme-option').forEach(b => {
        b.classList.remove('ring-2', 'ring-blue-500');
      });
      btn.classList.add('ring-2', 'ring-blue-500');
    });
  });
  
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeValue = document.getElementById('font-size-value');
  if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.addEventListener('input', function() {
      fontSizeValue.textContent = `${fontSizeSlider.value}px`;
    });
  }
  
  document.querySelectorAll('.tab-size-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-size-btn').forEach(b => {
        b.classList.remove('bg-purple-600');
        b.classList.add('bg-gray-700');
      });
      btn.classList.remove('bg-gray-700');
      btn.classList.add('bg-purple-600');
      const newSize = parseInt(btn.dataset.size);
      userSettings.tabSize = newSize;
      saveSettings();
      applySettings();
    });
  });
  
  if (resetColorsBtn) {
    resetColorsBtn.addEventListener('click', function() {
      const defaultColors = {
        keyword: '#ff9d00',
        string: '#7ec699',
        variable: '#e06c75',
        number: '#7fcef5',
        comment: '#676e95',
        def: '#c792ea'
      };
      
      document.querySelectorAll('.syntax-color-picker').forEach(picker => {
        const element = picker.dataset.element;
        if (defaultColors[element]) {
          picker.value = defaultColors[element];
        }
      });
    });
  }
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      saveSettingsFromForm();
      applySettings();
      if (settingsModal) settingsModal.classList.add('hidden');
      showToast('Settings saved successfully');
    });
  }
  
  if (languageSelector) {
    languageSelector.addEventListener('click', function(e) {
      const langBtn = e.target.closest('.language-badge');
      if (langBtn) {
        const language = langBtn.dataset.language;
        if (language) {
          changeLanguage(language);
        }
      }
    });
  }
  
  if (languageOptions) {
    languageOptions.addEventListener('click', function(e) {
      const option = e.target.closest('[data-language]');
      if (option) {
        const language = option.dataset.language;
        if (language) {
          createNewTab(language);
          toggleNewFileDropdown();
        }
      }
    });
  }
  
  document.addEventListener('click', (e) => {
    if (newFileDropdown && !e.target.closest('#new-file-btn') && !e.target.closest('#new-file-dropdown')) {
      newFileDropdown.classList.add('hidden');
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      runCode();
    }
    
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveFile();
    }
    
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleNewFileDropdown();
    }
    
    if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openFile();
    }

    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleSearch();
    }

    if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleSearch(true);
    }
  });

  if (searchPanel) {
    searchInput.addEventListener('input', performSearch);
    prevMatchBtn.addEventListener('click', () => findNext(true));
    nextMatchBtn.addEventListener('click', () => findNext(false));
    closeSearchBtn.addEventListener('click', closeSearch);
    replaceBtn.addEventListener('click', replaceSelection);
    replaceAllBtn.addEventListener('click', replaceAll);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        findNext(e.shiftKey);
      }
      if (e.key === 'Escape') {
        closeSearch();
      }
    });
  }

  // Add window close event listener
  window.addEventListener('beforeunload', function(e) {
    if (userSettings.autosave && tabs.length > 0) {
      try {
        localStorage.setItem('codecrystal-saved-files', JSON.stringify(tabs));
      } catch (e) {
        console.error('Error saving files:', e);
      }
    }
  });
}

function loadSettings() {
  let settings = null;
  const savedLocal = localStorage.getItem('codecrystal-settings');
  
  if (savedLocal) {
    try {
      settings = JSON.parse(savedLocal);
    } catch (e) {
      console.error('Error loading settings from localStorage:', e);
    }
  }
  
  if (!settings) {
    const cookieData = getCookie('codecrystal-settings');
    if (cookieData) {
      settings = cookieData;
    }
  }
  
  if (settings) {
    userSettings = { ...userSettings, ...settings };
  }
  
  applySettings();
}

function applySettings() {
  if (!codeEditorInstance) return;
  
  const newTabSize = userSettings.tabSize;
  codeEditorInstance.setOption('lineWrapping', userSettings.lineWrap);
  codeEditorInstance.setOption('lineNumbers', userSettings.lineNumbers);
  codeEditorInstance.setOption('tabSize', newTabSize);
  codeEditorInstance.setOption('indentUnit', newTabSize);
  codeEditorInstance.setOption('indentWithTabs', false);
  codeEditorInstance.setOption('extraKeys', {
    "Tab": function(cm) {
      const spaces = Array(newTabSize + 1).join(" ");
      cm.replaceSelection(spaces);
    }
  });
  
  const editorElement = document.querySelector('.CodeMirror');
  if (editorElement) {
    editorElement.style.fontSize = `${userSettings.fontSize}px`;
  }
  
  let themeClass = 'dark';
  switch(userSettings.theme) {
    case 'light':
      themeClass = 'cm-s-default';
      document.body.classList.remove('bg-gray-900');
      document.body.classList.add('bg-gray-100');
      document.body.classList.add('light-theme');
      document.querySelectorAll('.bg-gray-800').forEach(el => {
        el.classList.remove('bg-gray-800');
        el.classList.add('bg-gray-200');
      });
      document.querySelectorAll('.text-gray-200').forEach(el => {
        el.classList.remove('text-gray-200');
        el.classList.add('text-gray-800');
      });
      break;
    case 'cosmic':
      themeClass = 'cm-s-dracula';
      document.body.classList.remove('bg-gray-100');
      document.body.classList.remove('light-theme');
      document.body.classList.add('bg-gray-900');
      document.querySelectorAll('.bg-gray-200').forEach(el => {
        el.classList.remove('bg-gray-200');
        el.classList.add('bg-gray-800');
      });
      document.querySelectorAll('.text-gray-800').forEach(el => {
        el.classList.remove('text-gray-800');
        el.classList.add('text-gray-200');
      });
      break;
    case 'ocean':
      themeClass = 'cm-s-dracula';
      document.body.classList.remove('bg-gray-100');
      document.body.classList.remove('light-theme');
      document.body.classList.add('bg-gray-900');
      document.querySelectorAll('.bg-gray-200').forEach(el => {
        el.classList.remove('bg-gray-200');
        el.classList.add('bg-gray-800');
      });
      document.querySelectorAll('.text-gray-800').forEach(el => {
        el.classList.remove('text-gray-800');
        el.classList.add('text-gray-200');
      });
      break;
    default:
      themeClass = 'cm-s-dracula';
      document.body.classList.remove('bg-gray-100');
      document.body.classList.remove('light-theme');
      document.body.classList.add('bg-gray-900');
      document.querySelectorAll('.bg-gray-200').forEach(el => {
        el.classList.remove('bg-gray-200');
        el.classList.add('bg-gray-800');
      });
      document.querySelectorAll('.text-gray-800').forEach(el => {
        el.classList.remove('text-gray-800');
        el.classList.add('text-gray-200');
      });
  }
  
  codeEditorInstance.setOption('theme', themeClass === 'cm-s-dracula' ? 'dracula' : 'default');
  
  setTimeout(() => {
    codeEditorInstance.refresh();
  }, 100);
  
  const styleSheet = document.createElement('style');
  styleSheet.id = 'syntax-colors-style';
  
  const existingStyle = document.getElementById('syntax-colors-style');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  let css = `
    .cm-keyword {
      color: ${userSettings.syntaxColors.keyword} !important;
      text-shadow: 0 0 8px ${addAlpha(userSettings.syntaxColors.keyword, 0.6)} !important;
      font-weight: bold !important;
    }
    
    .cm-def, .cm-variable-2, .cm-property {
      color: ${userSettings.syntaxColors.def} !important;
      text-shadow: 0 0 8px ${addAlpha(userSettings.syntaxColors.def, 0.6)} !important;
    }
    
    .cm-string {
      color: ${userSettings.syntaxColors.string} !important;
      text-shadow: 0 0 8px ${addAlpha(userSettings.syntaxColors.string, 0.6)} !important;
    }
    
    .cm-number {
      color: ${userSettings.syntaxColors.number} !important;
      text-shadow: 0 0 8px ${addAlpha(userSettings.syntaxColors.number, 0.6)} !important;
    }
    
    .cm-comment {
      color: ${userSettings.syntaxColors.comment} !important;
      font-style: italic !important;
    }
    
    .cm-variable {
      color: ${userSettings.syntaxColors.variable} !important;
      text-shadow: 0 0 8px ${addAlpha(userSettings.syntaxColors.variable, 0.6)} !important;
    }
    
    .keyword-example { color: ${userSettings.syntaxColors.keyword}; }
    .string-example { color: ${userSettings.syntaxColors.string}; }
    .variable-example { color: ${userSettings.syntaxColors.variable}; }
    .number-example { color: ${userSettings.syntaxColors.number}; }
    .comment-example { color: ${userSettings.syntaxColors.comment}; }
    .function-example { color: ${userSettings.syntaxColors.def}; }
  `;
  
  styleSheet.innerText = css;
  document.head.appendChild(styleSheet);
  
  document.querySelectorAll('button.bg-blue-600').forEach(el => {
    el.style.backgroundColor = userSettings.accentColor;
  });
}

function changeLanguage(language) {
  const tab = tabs.find(t => t.id === activeTab);
  if (!tab) return;
  
  const oldExtension = tab.name.substring(tab.name.lastIndexOf('.'));
  const newExtension = getFileExtensionForLanguage(language);
  
  if (tab.name.lastIndexOf('.') !== -1) {
    tab.name = tab.name.substring(0, tab.name.lastIndexOf('.')) + newExtension;
    tab.displayName = tab.name;
  }
  
  const currentContent = tab.content;
  let updatedContent = currentContent;
  
  const isBasicComment = 
    currentContent.trim() === '// Start typing your code here...' ||
    currentContent.trim() === '# Start typing your code here...';
    
  if (!currentContent.trim() || isBasicComment) {
    updatedContent = getTemplateForLanguage(language);
  }
  
  tab.language = language;
  tab.content = updatedContent;
  tab.isUnsaved = true;
  
  if (codeEditorInstance) {
    codeEditorInstance.setValue(updatedContent);
    
    const langInfo = languages.find(l => l.id === language);
    if (langInfo) {
      codeEditorInstance.setOption('mode', langInfo.mime);
    }
  }
  
  updateLanguageUI(language);
  renderTabs();
  
  if (tab.language === 'html' && linkCssContainer) {
    linkCssContainer.classList.remove('hidden');
    updateLinkedCssInfo();
  } else if (linkCssContainer) {
    linkCssContainer.classList.add('hidden');
  }
}

function writeToTerminal(text, className = '') {
  if (!terminal) return;
  
  const line = document.createElement('div');
  line.className = `terminal-line ${className}`;
  line.textContent = text;
  terminal.appendChild(line);
  
  terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
  if (!terminal) return;
  
  terminal.innerHTML = '';
  writeToTerminal('Terminal cleared');
}

function renameFile(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  
  const oldName = tab.name;
  const oldExtension = oldName.includes('.') ? oldName.substring(oldName.lastIndexOf('.')) : '';

  const nameWithoutExt = oldName.includes('.') ? oldName.substring(0, oldName.lastIndexOf('.')) : oldName;
  let newName = prompt('Enter new file name:', nameWithoutExt);
  
  if (!newName || newName === nameWithoutExt) return;

  if (oldExtension && !newName.endsWith(oldExtension)) {
    newName += oldExtension;
  }
  
  tab.name = newName;
  tab.displayName = newName;
  tab.isUnsaved = true;

  if (tab.language === 'css') {
    tabs.forEach(htmlTab => {
      if (htmlTab.language === 'html' && htmlTab.content.includes(`href="${oldName}"`)) {
        const regex = new RegExp(`<link[^>]*href=["']${oldName}["'][^>]*>`, 'g');
        const newLinkTag = `<link rel="stylesheet" href="${newName}">`;
        
        if (regex.test(htmlTab.content)) {
          htmlTab.content = htmlTab.content.replace(regex, newLinkTag);
          htmlTab.isUnsaved = true;
          
          if (codeEditorInstance && activeTab === htmlTab.id) {
            codeEditorInstance.setValue(htmlTab.content);
          }
        }
      }
    });
  }
  
  renderTabs();
  showToast(`Renamed to ${newName}`);
}

async function runPythonCode(code) {
  writeToTerminal('Initializing Python environment...', 'terminal-warning');
  
  try {
    if (!pyodideInstance) {
      if (pyodideLoading) {
        writeToTerminal('Python environment is still loading, please wait...', 'terminal-warning');
        return;
      }
      
      pyodideLoading = true;
      writeToTerminal('Loading Python (this may take a moment on first run)...', 'terminal-warning');
  
      try {
        pyodideInstance = await loadPyodide();
        writeToTerminal('Python environment loaded successfully!', 'terminal-success');
    
        await pyodideInstance.runPythonAsync(`
          import sys
          from js import writeToTerminalFromPython
          
          class CustomStdout:
            def write(self, text):
              writeToTerminalFromPython(text)
            def flush(self):
              pass
          
          sys.stdout = CustomStdout()
          sys.stderr = CustomStdout()
        `);
        
      } catch (err) {
        writeToTerminal(`Failed to load Python: ${err.message}`, 'terminal-error');
        pyodideLoading = false;
        return;
      }
      
      pyodideLoading = false;
    }
    
    writeToTerminal('Running Python code...', 'terminal-success');
    await pyodideInstance.runPythonAsync(code);
    writeToTerminal('Python execution completed', 'terminal-success');
    
  } catch (err) {
    writeToTerminal(`Python Error: ${err.message}`, 'terminal-error');
  }
}

function linkCssFile() {
  if (!linkCssContainer || !linkedCssInfo || !linkCssBtn) return;
  
  const currentTab = tabs.find(t => t.id === activeTab);
  if (!currentTab || currentTab.language !== 'html') return;
  
  let isLinked = false;
  let linkedCssTabId = null;
  
  // Look for HTML tab ID in the values of linkedFiles
  for (const [cssTabId, htmlTabId] of Object.entries(linkedFiles)) {
    if (parseInt(htmlTabId) === currentTab.id) {
      isLinked = true;
      linkedCssTabId = parseInt(cssTabId);
      break;
    }
  }
  
  if (isLinked && linkedCssTabId) {
    const cssTab = tabs.find(t => t.id === linkedCssTabId);
    if (cssTab) {
      const linkRegex = new RegExp(`<link[^>]*href=['"]${cssTab.name}['"][^>]*>`, 'g');
      currentTab.content = currentTab.content.replace(linkRegex, '');
      currentTab.isUnsaved = true;
      
      if (codeEditorInstance && activeTab === currentTab.id) {
        codeEditorInstance.setValue(currentTab.content);
      }
      
      delete linkedFiles[linkedCssTabId];
      linkCssBtn.textContent = 'Link CSS File';
      linkedCssInfo.classList.add('hidden');
      showToast('CSS file unlinked');
      updateLinkedCssInfo(); // Add this line to ensure UI is updated
      renderTabs();
      updatePreview(true);
    }
  } else {
    const cssFiles = tabs.filter(t => t.language === 'css');
    
    if (cssFiles.length === 0) {
      showToast('No CSS files available. Create a CSS file first.');
      return;
    }
    
    if (cssFiles.length === 1) {
      linkCssToHtml(currentTab, cssFiles[0]);
      return;
    }
    
    const cssFile = prompt('Enter the name of the CSS file to link:', cssFiles[0].name);
    if (!cssFile) return;
    
    const selectedCss = cssFiles.find(t => t.name === cssFile);
    if (selectedCss) {
      linkCssToHtml(currentTab, selectedCss);
    } else {
      showToast(`CSS file '${cssFile}' not found`);
    }
  }
}

function linkCssToHtml(htmlTab, cssTab) {
  if (!htmlTab.content.includes('<head>')) {
    showToast('HTML file must have a <head> tag to link CSS');
    return;
  }

  const linkTag = `<link rel="stylesheet" href="${cssTab.name}">`;

  if (!htmlTab.content.includes(linkTag)) {
    const headMatch = htmlTab.content.match(/(\s*)<head>/);
    const indent = headMatch && headMatch[1] ? headMatch[1] + '  ' : '    ';
    
    htmlTab.content = htmlTab.content.replace('<head>', `<head>\n${indent}${linkTag}`);
    htmlTab.isUnsaved = true;
    
    if (codeEditorInstance && activeTab === htmlTab.id) {
      codeEditorInstance.setValue(htmlTab.content);
    }
  }
  
  linkedFiles[cssTab.id] = htmlTab.id;
  
  showToast(`Linked to ${cssTab.name}`);
  renderTabs();
  updatePreview(true);
  updateLinkedCssInfo(); // Moved to the end to ensure it's the last operation
}

function updateLinkedCssInfo() {
  if (!linkedCssInfo || !linkCssBtn) return;
  
  const currentTab = tabs.find(t => t.id === activeTab);
  if (!currentTab || currentTab.language !== 'html') return;
  
  let linkedCssName = null;
  
  // Look for HTML tab ID in the values of linkedFiles
  for (const [cssTabId, htmlTabId] of Object.entries(linkedFiles)) {
    if (parseInt(htmlTabId) === currentTab.id) {
      const cssTab = tabs.find(t => t.id === parseInt(cssTabId));
      if (cssTab) {
        linkedCssName = cssTab.name;
        break;
      }
    }
  }
  
  if (linkedCssName) {
    linkedCssInfo.textContent = `Linked to: ${linkedCssName}`;
    linkedCssInfo.classList.remove('hidden');
    linkCssBtn.textContent = 'Unlink CSS';
  } else {
    linkedCssInfo.classList.add('hidden');
    linkCssBtn.textContent = 'Link CSS File';
  }
}

function addAlpha(color, opacity) {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

function saveSettings() {
  try {
    localStorage.setItem('codecrystal-settings', JSON.stringify(userSettings));
    setCookie('codecrystal-settings', userSettings, 365);
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + JSON.stringify(value) + ";" + expires + ";path=/";
}

function getCookie(name) {
  const cookieName = name + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  
  for (let i = 0; i < cookieArray.length; i++) {
    let cookie = cookieArray[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(cookieName) === 0) {
      try {
        return JSON.parse(cookie.substring(cookieName.length, cookie.length));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

function showFolderAccessHelp() {
  const helpModal = document.createElement('div');
  helpModal.className = 'fixed inset-0 flex items-center justify-center z-50';
  helpModal.innerHTML = `
    <div class="fixed inset-0 bg-black opacity-50" id="help-backdrop"></div>
    <div class="bg-gray-800 rounded-lg shadow-lg w-11/12 md:w-3/4 lg:w-1/2 max-h-[80vh] overflow-y-auto relative z-10 p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">Folder Access Not Supported</h2>
        <button id="close-help-btn" class="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="text-gray-300 space-y-4">
        <p>Your browser doesn't support direct folder access. Here are some alternatives:</p>
        
        <div class="bg-gray-700 p-4 rounded">
          <h3 class="font-bold mb-2">Option 1: Open multiple files individually</h3>
          <p>You can open each file separately using the Open File button.</p>
          <button id="open-file-help-btn" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded">Open File</button>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <h3 class="font-bold mb-2">Option 2: Download as project when done</h3>
          <p>Work on your files individually, and when you're finished, download everything as a zip project.</p>
          <button id="download-help-btn" class="mt-2 px-4 py-2 bg-purple-600 text-white rounded">Download Project</button>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <h3 class="font-bold mb-2">Option 3: Try a different browser</h3>
          <p>Folder access is supported in recent versions of Chrome, Edge, and other Chromium-based browsers.</p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(helpModal);

  const closeHelpBtn = helpModal.querySelector('#close-help-btn');
  const helpBackdrop = helpModal.querySelector('#help-backdrop');
  const openFileHelpBtn = helpModal.querySelector('#open-file-help-btn');
  const downloadHelpBtn = helpModal.querySelector('#download-help-btn');
  
  closeHelpBtn.addEventListener('click', () => {
    document.body.removeChild(helpModal);
  });
  
  helpBackdrop.addEventListener('click', () => {
    document.body.removeChild(helpModal);
  });
  
  openFileHelpBtn.addEventListener('click', () => {
    document.body.removeChild(helpModal);
    openFile();
  });
  
  downloadHelpBtn.addEventListener('click', () => {
    document.body.removeChild(helpModal);
    downloadProject();
  });
}

function toggleNewFileDropdown() {
  if (!newFileDropdown) return;
  
  if (newFileDropdown.classList.contains('hidden')) {
    newFileDropdown.classList.remove('hidden');
  } else {
    newFileDropdown.classList.add('hidden');
  }
}

function togglePreview() {
  if (!previewPanel || !editorArea) return;
  
  showPreview = !showPreview;
  
  if (showPreview) {
    previewPanel.classList.remove('hidden');
    editorArea.classList.remove('w-full');
    editorArea.classList.add('w-1/2');
    updatePreview(true);
  } else {
    previewPanel.classList.add('hidden');
    editorArea.classList.remove('w-1/2');
    editorArea.classList.add('w-full');
  }
}

function toggleTerminal() {
  if (!terminalPanel || !editorArea) return;
  
  showTerminal = !showTerminal;
  
  if (showTerminal) {
    terminalPanel.classList.remove('hidden');
    if (showPreview) {
      editorArea.classList.remove('w-1/2', 'w-full');
      editorArea.classList.add('w-1/3');
      previewPanel.classList.remove('w-1/2');
      previewPanel.classList.add('w-1/3');
      terminalPanel.classList.remove('w-1/2');
      terminalPanel.classList.add('w-1/3');
    } else {
      editorArea.classList.remove('w-full');
      editorArea.classList.add('w-1/2');
      terminalPanel.classList.remove('w-1/2');
      terminalPanel.classList.add('w-1/2');
    }
  } else {
    terminalPanel.classList.add('hidden');
    if (showPreview) {
      editorArea.classList.remove('w-1/3', 'w-full');
      editorArea.classList.add('w-1/2');
      previewPanel.classList.remove('w-1/3');
      previewPanel.classList.add('w-1/2');
    } else {
      editorArea.classList.remove('w-1/2', 'w-1/3');
      editorArea.classList.add('w-full');
    }
  }
}

function loadSettingsToForm() {
  const accentColorPicker = document.getElementById('accent-color-picker');
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeValue = document.getElementById('font-size-value');
  const lineWrapCheckbox = document.getElementById('line-wrap-checkbox');
  const lineNumbersCheckbox = document.getElementById('line-numbers-checkbox');
  const autosaveCheckbox = document.getElementById('autosave-checkbox');
  
  document.querySelectorAll('.theme-option').forEach(btn => {
    if (btn.dataset.theme === userSettings.theme) {
      btn.classList.add('ring-2', 'ring-blue-500');
    } else {
      btn.classList.remove('ring-2', 'ring-blue-500');
    }
  });
  
  document.querySelectorAll('.tab-size-btn').forEach(btn => {
    if (parseInt(btn.dataset.size) === userSettings.tabSize) {
      btn.classList.remove('bg-gray-700');
      btn.classList.add('bg-purple-600');
    } else {
      btn.classList.remove('bg-purple-600');
      btn.classList.add('bg-gray-700');
    }
  });
  
  if (accentColorPicker) {
    accentColorPicker.value = userSettings.accentColor;
  }
  
  if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.value = userSettings.fontSize;
    fontSizeValue.textContent = `${userSettings.fontSize}px`;
  }
  
  if (lineWrapCheckbox) {
    lineWrapCheckbox.checked = userSettings.lineWrap;
  }
  
  if (lineNumbersCheckbox) {
    lineNumbersCheckbox.checked = userSettings.lineNumbers;
  }
  
  if (autosaveCheckbox) {
    autosaveCheckbox.checked = userSettings.autosave;
  }
  
  document.querySelectorAll('.syntax-color-picker').forEach(picker => {
    const element = picker.dataset.element;
    if (userSettings.syntaxColors[element]) {
      picker.value = userSettings.syntaxColors[element];
    }
  });
}

function saveSettingsFromForm() {
  const accentColorPicker = document.getElementById('accent-color-picker');
  const fontSizeSlider = document.getElementById('font-size-slider');
  const lineWrapCheckbox = document.getElementById('line-wrap-checkbox');
  const lineNumbersCheckbox = document.getElementById('line-numbers-checkbox');
  const autosaveCheckbox = document.getElementById('autosave-checkbox');
  
  let selectedTheme = userSettings.theme;
  document.querySelectorAll('.theme-option').forEach(btn => {
    if (btn.classList.contains('ring-2')) {
      selectedTheme = btn.dataset.theme;
    }
  });
  
  let selectedTabSize = 2;
  document.querySelectorAll('.tab-size-btn').forEach(btn => {
    if (btn.classList.contains('bg-purple-600')) {
      selectedTabSize = parseInt(btn.dataset.size);
    }
  });
  
  userSettings.theme = selectedTheme;
  userSettings.accentColor = accentColorPicker ? accentColorPicker.value : userSettings.accentColor;
  userSettings.fontSize = fontSizeSlider ? parseInt(fontSizeSlider.value) : userSettings.fontSize;
  userSettings.tabSize = selectedTabSize;
  userSettings.lineWrap = lineWrapCheckbox ? lineWrapCheckbox.checked : userSettings.lineWrap;
  userSettings.lineNumbers = lineNumbersCheckbox ? lineNumbersCheckbox.checked : userSettings.lineNumbers;
  userSettings.autosave = autosaveCheckbox ? autosaveCheckbox.checked : false;
  
  document.querySelectorAll('.syntax-color-picker').forEach(picker => {
    const element = picker.dataset.element;
    userSettings.syntaxColors[element] = picker.value;
  });
  
  saveSettings();
}

async function shareWorkspace() {
  if (tabs.length === 0) {
    showToast('No files to share');
    return;
  }

  try {

    const workspaceData = tabs.map(tab => ({
      name: tab.name,
      language: tab.language,
      content: tab.content
    }));

    const jsonString = JSON.stringify(workspaceData);
    const compressedData = await compressData(jsonString);

    const baseUrl = 'https://codecrystal.vercel.app/';
    const shareUrl = `${baseUrl}?share=${compressedData}`;

    await navigator.clipboard.writeText(shareUrl);
    showToast('Share link copied to clipboard!');
    
  } catch (err) {
    showToast('Error creating share link');
    console.error('Error sharing workspace:', err);
  }
}

async function compressData(str) {

  const strBytes = new TextEncoder().encode(str);

  const compressed = await gzip(strBytes);

  return btoa(String.fromCharCode.apply(null, compressed))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function decompressData(compressed) {
  try {

    const base64 = compressed
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const decompressed = await ungzip(bytes);

    return new TextDecoder().decode(decompressed);
  } catch (err) {
    console.error('Error decompressing data:', err);
    throw new Error('Invalid share link');
  }
}

async function loadSharedWorkspace(compressedData) {
  try {
    showToast('Loading shared workspace...');

    const jsonString = await decompressData(compressedData);
    const workspaceData = JSON.parse(jsonString);
    const hasUnsavedChanges = tabs.some(tab => tab.isUnsaved);
    
    if (tabs.length > 0) {
      let shouldProceed = true;
      
      if (hasUnsavedChanges) {
        shouldProceed = confirm('You have unsaved changes in your current workspace. Do you want to load the shared workspace and discard your changes?');
      } else {
        shouldProceed = confirm('Do you want to replace your current workspace with the shared one?');
      }
      
      if (!shouldProceed) {
        const shouldMerge = confirm('Would you like to add the shared files to your existing workspace instead?');
        
        if (shouldMerge) {
          workspaceData.forEach(file => {
            let fileName = file.name;
            let counter = 1;
            while (tabs.some(tab => tab.name === fileName)) {
              const ext = fileName.lastIndexOf('.');
              fileName = ext !== -1 
                ? `${fileName.slice(0, ext)}_${counter}${fileName.slice(ext)}`
                : `${fileName}_${counter}`;
              counter++;
            }
            
            const id = Date.now() + Math.random();
            const tab = {
              id: id,
              name: fileName,
              displayName: fileName,
              language: file.language,
              content: file.content,
              isUnsaved: false,
              fileHandle: null
            };
            tabs.push(tab);
          });
          
          renderTabs();
          showToast('Shared files added to workspace');
          return;
        } else {
          showToast('Shared workspace loading cancelled');
          return;
        }
      }
    }

    tabs = [];

    workspaceData.forEach(file => {
      const id = Date.now() + Math.random();
      const tab = {
        id: id,
        name: file.name,
        displayName: file.name,
        language: file.language,
        content: file.content,
        isUnsaved: false,
        fileHandle: null
      };
      tabs.push(tab);
    });

    renderTabs();
    if (tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
    
    showToast('Shared workspace loaded successfully!');
    
  } catch (err) {
    showToast('Error loading shared workspace');
    console.error('Error loading shared workspace:', err);
  }
}

async function gzip(input) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(input);
  writer.close();
  const output = [];
  const reader = cs.readable.getReader();
  
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    output.push(...value);
  }
  
  return new Uint8Array(output);
}

async function ungzip(input) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(input);
  writer.close();
  const output = [];
  const reader = ds.readable.getReader();
  
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    output.push(...value);
  }
  
  return new Uint8Array(output);
}

function updateStatusIndicators() {
  const tab = tabs.find(t => t.id === activeTab);
  if (!tab) return;

  // Update character count
  const charCount = tab.content.length;
  charCountIndicator.textContent = `Chars: ${charCount.toLocaleString()}`;

  // Update file size
  const bytes = new Blob([tab.content]).size;
  let sizeText = '';
  if (bytes < 1024) {
    sizeText = `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    sizeText = `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    sizeText = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  fileSizeIndicator.textContent = `Size: ${sizeText}`;

  // Update last modified
  const now = new Date();
  tab.lastModified = now;
  const timeAgo = getTimeAgo(now);
  lastModifiedIndicator.textContent = `Last modified: ${timeAgo}`;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) {
    return 'Just now';
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function toggleSearch(showReplace = false) {
  if (!searchPanel || !codeEditorInstance) return;

  const isHidden = searchPanel.classList.contains('hidden');
  
  if (isHidden) {
    searchPanel.classList.remove('hidden');
    const selectedText = codeEditorInstance.getSelection();
    if (selectedText) {
      searchInput.value = selectedText;
      performSearch();
    }
    searchInput.focus();
    document.getElementById('replace-container').style.display = showReplace ? 'flex' : 'none';
  } else {
    closeSearch();
  }
}

function closeSearch() {
  if (!searchPanel) return;
  
  searchPanel.classList.add('hidden');
  clearSearch();
  codeEditorInstance.focus();
}

function clearSearch() {
  if (!codeEditorInstance) return;
  
  currentSearchMarkers.forEach(marker => marker.clear());
  currentSearchMarkers = [];
  currentSearchIndex = -1;
}

function performSearch() {
  clearSearch();
  
  const searchTerm = searchInput.value;
  if (!searchTerm) return;
  
  let cursor = codeEditorInstance.getSearchCursor(searchTerm, null, {caseFold: false});
  let found = false;
  
  while (cursor.findNext()) {
    found = true;
    const from = cursor.from();
    const to = cursor.to();
    const marker = codeEditorInstance.markText(from, to, {
      className: 'search-highlight'
    });
    currentSearchMarkers.push(marker);
  }
  
  if (found) {
    currentSearchIndex = 0;
    findNext(false);
  }
}

function findNext(backwards = false) {
  if (currentSearchMarkers.length === 0) return;
  
  // Clear active highlight from current marker
  if (currentSearchIndex >= 0) {
    const currentMarker = currentSearchMarkers[currentSearchIndex];
    const currentPos = currentMarker.find();
    if (currentPos) {
      currentMarker.clear();
      currentSearchMarkers[currentSearchIndex] = codeEditorInstance.markText(currentPos.from, currentPos.to, {
        className: 'search-highlight'
      });
    }
  }
  
  if (backwards) {
    currentSearchIndex--;
    if (currentSearchIndex < 0) {
      currentSearchIndex = currentSearchMarkers.length - 1;
    }
  } else {
    currentSearchIndex++;
    if (currentSearchIndex >= currentSearchMarkers.length) {
      currentSearchIndex = 0;
    }
  }
  
  const marker = currentSearchMarkers[currentSearchIndex];
  const pos = marker.find();
  if (pos) {
    // Set active highlight for current marker
    marker.clear();
    currentSearchMarkers[currentSearchIndex] = codeEditorInstance.markText(pos.from, pos.to, {
      className: 'search-highlight active'
    });
    
    // Set cursor and selection
    codeEditorInstance.setCursor(pos.from);
    codeEditorInstance.setSelection(pos.from, pos.to);
    
    // Ensure the match is visible
    codeEditorInstance.scrollIntoView(pos.from, 20);
  }
}

function replaceSelection() {
  if (!codeEditorInstance || currentSearchMarkers.length === 0) return;
  
  const replaceText = replaceInput.value;
  const marker = currentSearchMarkers[currentSearchIndex];
  const pos = marker.find();
  
  if (pos) {
    codeEditorInstance.replaceRange(replaceText, pos.from, pos.to);
    
    // Clear the current marker
    marker.clear();
    currentSearchMarkers.splice(currentSearchIndex, 1);
    
    // If we have more markers, move to the next one
    if (currentSearchMarkers.length > 0) {
      if (currentSearchIndex >= currentSearchMarkers.length) {
        currentSearchIndex = currentSearchMarkers.length - 1;
      }
      findNext(false);
    } else {
      // If no more markers, perform a new search
      performSearch();
    }
  }
}

function replaceAll() {
  if (!codeEditorInstance || !searchInput.value) return;
  
  const searchTerm = searchInput.value;
  const replaceText = replaceInput.value;
  const content = codeEditorInstance.getValue();
  
  const newContent = content.replace(new RegExp(escapeRegExp(searchTerm), 'g'), replaceText);
  codeEditorInstance.setValue(newContent);
  handleEditorInput();
  closeSearch();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Add this CSS to style.css
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .search-highlight {
    background-color: rgba(255, 255, 0, 0.3);
  }
  .search-highlight.active {
    background-color: rgba(255, 165, 0, 0.5);
  }
`;
document.head.appendChild(styleSheet);
