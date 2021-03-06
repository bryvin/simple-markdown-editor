import React from 'react';
import ComponentManager from 'sn-components-api';
var MarkdownIt = require('markdown-it');

import markdownItHighlight from 'markdown-it-highlight';

const EditMode = 0;
const SplitMode = 1;
const PreviewMode = 2;

export default class Home extends React.Component {

  constructor(props) {
    super(props);

    this.modes = [
      {mode: EditMode, label: "Edit", css: "edit"},
      {mode: SplitMode, label: "Split", css: "split"},
      {mode: PreviewMode, label: "Preview", css: "preview"},
    ];

    this.state = {mode: this.modes[0]};
  }

  componentDidMount() {
    this.simpleMarkdown = document.getElementById("simple-markdown");
    this.editor = document.getElementById("editor");
    this.preview = document.getElementById("preview");

    this.configureMarkdown();
    this.connectToBridge();
    this.updatePreviewText();
    this.addChangeListener();

    this.configureResizer();
    this.addTabHandler();
  }

  setModeFromModeValue(value) {
    for(var mode of this.modes) {
      if(mode.mode == value) {
        this.setState({mode: mode});
        return;
      }
    }
  }

  changeMode(mode) {
    this.setState({mode: mode});

    this.componentManager.setComponentDataValueForKey("mode", mode.mode);
  }

  render() {

    return (
      <div id="simple-markdown">

        <div id="editor-container" className={this.state.mode.css}>
          <textarea dir="auto" id="editor" className={this.state.mode.css}></textarea>
          <div id="column-resizer" className={this.state.mode.css}></div>
          <div id="preview" className={this.state.mode.css}></div>
        </div>

        <div id="footer">
          <div className="segmented-buttons-container">

            <div className="buttons">
              {this.modes.map(mode =>
                <div onClick={() => this.changeMode(mode)} className={"button " + (this.state.mode == mode ? "selected" : "")}>
                  <div className="label">
                    {mode.label}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    )
  }

  configureMarkdown() {
    var markdownitOptions = {
        // automatically render raw links as anchors.
        linkify: true
    };

    this.markdown = MarkdownIt(markdownitOptions)
      .use(require('markdown-it-footnote'))
      .use(require('markdown-it-task-lists'))
      .use(markdownItHighlight);

      // Remember old renderer, if overriden, or proxy to default renderer
      var defaultRender = this.markdown.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

      this.markdown.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        // If you are sure other plugins can't add `target` - drop check below
        var aIndex = tokens[idx].attrIndex('target');

        if (aIndex < 0) {
          tokens[idx].attrPush(['target', '_blank']); // add new attribute
        } else {
          tokens[idx].attrs[aIndex][1] = '_blank';    // replace value of existing attr
        }

        // pass token to default renderer.
        return defaultRender(tokens, idx, options, env, self);
      };
  }

  connectToBridge() {
    var permissions = [
      {
        name: "stream-context-item"
      }
    ]

    this.componentManager = new ComponentManager(permissions, () => {
      var savedMode = this.componentManager.componentDataValueForKey("mode");
      if(savedMode) {
        this.setModeFromModeValue(savedMode);
      }
    });

    // componentManager.loggingEnabled = true;

    this.componentManager.streamContextItem((note) => {
      this.note = note;

       // Only update UI on non-metadata updates.
      if(note.isMetadataUpdate) {
        return;
      }

      this.editor.value = note.content.text;
      this.preview.innerHTML = this.markdown.render(note.content.text);
    });

  }

  updatePreviewText() {
    var text = this.editor.value || "";
    this.preview.innerHTML = this.markdown.render(text);
    return text;
  }

  addChangeListener() {
    document.getElementById("editor").addEventListener("input", (event) => {
      var text = this.updatePreviewText();
      if(this.note) {
        this.note.content.text = text;
        this.componentManager.saveItem(this.note);
      }
    })
  }

  removeSelection() {
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    } else if (document.selection) {
      document.selection.empty();
    }
  }

  configureResizer() {
    var pressed = false;
    var startWidth = this.editor.offsetWidth;
    var startX;
    var lastDownX;

    var columnResizer = document.getElementById("column-resizer");
    var resizerWidth = columnResizer.offsetWidth;

    var safetyOffset = 15;

    columnResizer.addEventListener("mousedown", (event) => {
      pressed = true;
      lastDownX = event.clientX;
      columnResizer.classList.add("dragging");
      this.editor.classList.add("no-selection");
    })

    document.addEventListener("mousemove", (event) => {
      if(!pressed) {
        return;
      }

      var x = event.clientX;
      if(x < resizerWidth/2 + safetyOffset) {
        x = resizerWidth/2 + safetyOffset;
      } else if(x > this.simpleMarkdown.offsetWidth - resizerWidth - safetyOffset) {
        x = this.simpleMarkdown.offsetWidth - resizerWidth - safetyOffset;
      }

      var colLeft = x - resizerWidth/2;
      columnResizer.style.left = colLeft + "px";
      this.editor.style.width = (colLeft - safetyOffset) + "px";

      this.removeSelection();
    })

    document.addEventListener("mouseup", (event) => {
      if(pressed) {
        pressed = false;
        columnResizer.classList.remove("dragging");
        this.editor.classList.remove("no-selection");
      }
    })
  }

  addTabHandler() {
    // Tab handler
    this.editor.addEventListener('keydown', function(event){
      if (!event.shiftKey && event.which == 9) {
        event.preventDefault();

        // Using document.execCommand gives us undo support
        if(!document.execCommand("insertText", false, "\t")) {
          // document.execCommand works great on Chrome/Safari but not Firefox
          var start = this.selectionStart;
          var end = this.selectionEnd;
          var spaces = "    ";

           // Insert 4 spaces
          this.value = this.value.substring(0, start)
            + spaces + this.value.substring(end);

          // Place cursor 4 spaces away from where
          // the tab key was pressed
          this.selectionStart = this.selectionEnd = start + 4;
        }
      }
    });
  }

}
