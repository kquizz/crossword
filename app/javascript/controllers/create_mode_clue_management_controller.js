import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    puzzleId: String
  }

  connect() {
    console.log("Create Mode Clue Management Controller connected")
    
    // Initialize clue tracking state
    this.usedClueIds = new Set()
    this.appliedClues = new Map()
  }

  // Sync clue tracking data from main controller
  syncClueData(usedClueIds, appliedClues) {
    this.usedClueIds = usedClueIds
    this.appliedClues = appliedClues
  }

  // Get intersecting constraints for a word to help with clue matching
  getIntersectingConstraints(wordInfo, gridData, getWordPositions, calculateGridNumbering) {
    const constraints = []
    const positions = getWordPositions(wordInfo)

    console.log(`🎯 Getting intersecting constraints for ${wordInfo.direction} word at ${wordInfo.startRow},${wordInfo.startCol}`)
    console.log('📍 Word positions:', positions)

    positions.forEach((pos, index) => {
      // For each position in the current word, check if there are intersecting words
      // that would constrain what letter can go there
      const intersectingWordInfo = this.getIntersectingWordAt(pos.row, pos.col, wordInfo.direction, gridData, calculateGridNumbering)
      
      if (intersectingWordInfo && intersectingWordInfo.hasConstraints) {
        const constraint = {
          position: index, // Position within the current word (0-based)
          intersecting_direction: intersectingWordInfo.direction,
          intersecting_number: intersectingWordInfo.number,
          intersecting_pattern: intersectingWordInfo.pattern,
          intersecting_position: intersectingWordInfo.intersectionPosition
        }
        constraints.push(constraint)
        console.log(`✓ Found constraint at position ${index}:`, constraint)
      } else {
        console.log(`○ No constraint at position ${index} (${pos.row},${pos.col})`)
      }
    })

    console.log('🔗 Final constraints:', constraints)
    return constraints
  }

  // Find intersecting word information at a specific position
  getIntersectingWordAt(row, col, currentDirection, gridData, calculateGridNumbering) {
    // Get the perpendicular direction
    const intersectingDirection = currentDirection === 'across' ? 'down' : 'across'
    
    let wordInfo = null
    const numbering = calculateGridNumbering(gridData)
    const gridHeight = gridData.length
    const gridWidth = gridData[0]?.length || 15

    if (intersectingDirection === 'across') {
      // Find start of intersecting across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1, gridData, gridHeight, gridWidth)) {
        startCol--
      }

      // Find end of intersecting across word
      let endCol = col
      while (endCol < gridWidth - 1 && !this.isCellBlocked(row, endCol + 1, gridData, gridHeight, gridWidth)) {
        endCol++
      }

      // Check if this is a valid word (more than 1 letter)
      if (endCol > startCol) {
        let pattern = ''
        let hasConstraints = false
        
        for (let c = startCol; c <= endCol; c++) {
          const cellValue = gridData[row][c]
          if (cellValue && cellValue !== '#') {
            pattern += cellValue
            hasConstraints = true // Has existing letters
          } else {
            pattern += '_'
          }
        }

        // Even if no letters exist yet, this is still a constraint if it's a valid word slot
        // Check if this position would start a numbered word
        const wordNumber = numbering[`${row},${startCol}`]
        if (wordNumber || hasConstraints) {
          wordInfo = {
            direction: 'across',
            pattern: pattern,
            intersectionPosition: col - startCol, // This is the key fix - position within the intersecting word
            hasConstraints: hasConstraints || (endCol - startCol + 1) >= 3 // Constraint if it has letters OR is a valid word length
          }
          console.log(`🔍 Found intersecting across word at row ${row}, cols ${startCol}-${endCol}`)
          console.log(`   Pattern: "${pattern}", intersection at position ${col - startCol}`)
        }
      }
    } else {
      // Find start of intersecting down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col, gridData, gridHeight, gridWidth)) {
        startRow--
      }

      // Find end of intersecting down word
      let endRow = row
      while (endRow < gridHeight - 1 && !this.isCellBlocked(endRow + 1, col, gridData, gridHeight, gridWidth)) {
        endRow++
      }

      // Check if this is a valid word (more than 1 letter)
      if (endRow > startRow) {
        let pattern = ''
        let hasConstraints = false
        
        for (let r = startRow; r <= endRow; r++) {
          const cellValue = gridData[r][col]
          if (cellValue && cellValue !== '#') {
            pattern += cellValue
            hasConstraints = true // Has existing letters
          } else {
            pattern += '_'
          }
        }

        // Even if no letters exist yet, this is still a constraint if it's a valid word slot
        // Check if this position would start a numbered word
        const wordNumber = numbering[`${startRow},${col}`]
        if (wordNumber || hasConstraints) {
          wordInfo = {
            direction: 'down',
            pattern: pattern,
            intersectionPosition: row - startRow, // This is the key fix - position within the intersecting word
            hasConstraints: hasConstraints || (endRow - startRow + 1) >= 3 // Constraint if it has letters OR is a valid word length
          }
          console.log(`🔍 Found intersecting down word at col ${col}, rows ${startRow}-${endRow}`)
          console.log(`   Pattern: "${pattern}", intersection at position ${row - startRow}`)
        }
      }
    }

    return wordInfo
  }

  // Helper method to check if cell is blocked
  isCellBlocked(row, col, gridData, gridHeight, gridWidth) {
    if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) {
      return true
    }
    return gridData[row][col] === '#'
  }

  // Display clue suggestions in the UI
  displayCluesSuggestions(clues, wordInfo) {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (!cluesPanel) return

    // Filter out clues that have already been used
    const availableClues = clues.filter(clue => !this.usedClueIds.has(clue.id.toString()))

    // Create a unique key for this word position
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    const currentAppliedClue = this.appliedClues.get(wordKey)

    let html = `
      <div class="clues-header">
        <h4>Matching Clues</h4>
        <p>Word: ${wordInfo.number} ${wordInfo.direction} (${wordInfo.length} letters)</p>
        <p>Pattern: ${wordInfo.pattern.replace(/_/g, '□')}</p>
      </div>
    `

    // If there's already a clue applied to this word, show undo option
    if (currentAppliedClue) {
      html += `
        <div class="current-clue">
          <h5>Current Clue:</h5>
          <div class="clue-item applied">
            <div class="clue-text">${currentAppliedClue.clueText}</div>
            <div class="clue-answer">${currentAppliedClue.answer} (${currentAppliedClue.answer.length})</div>
          </div>
          <button class="btn btn-sm btn-outline-warning undo-clue-btn" data-word-key="${wordKey}">
            Undo This Clue
          </button>
        </div>
        <hr>
      `
    }

    if (availableClues.length === 0) {
      html += '<p class="no-clues">No unused matching clues found</p>'
    } else {
      html += '<div class="clues-list">'
      availableClues.forEach(clue => {
        let completionInfo = ''
        if (clue.completed_intersections && clue.completed_intersections.length > 0) {
          const completions = clue.completed_intersections.map(comp => 
            `${comp.number} ${comp.direction}: "${comp.clue_text}"`
          ).join(', ')
          completionInfo = `<div class="completion-info">✅ Will complete: ${completions}</div>`
        }
        
        html += `
          <div class="clue-item clickable" data-clue-id="${clue.id}" data-answer="${clue.answer}" data-completions='${JSON.stringify(clue.completed_intersections || [])}'>
            <div class="clue-text">${clue.clue_text}</div>
            <div class="clue-answer">${clue.answer} (${clue.answer.length})</div>
            ${completionInfo}
          </div>
        `
      })
      html += '</div>'
    }

    cluesPanel.innerHTML = html

    // Add event listeners for clickable clue items
    cluesPanel.querySelectorAll('.clue-item.clickable').forEach(item => {
      item.addEventListener('click', (e) => {
        const clueId = item.dataset.clueId
        const answer = item.dataset.answer
        const completions = JSON.parse(item.dataset.completions || '[]')
        this.useClueForCurrentWord(clueId, answer, wordInfo, completions)
      })
    })

    // Add event listener for undo button
    const undoBtn = cluesPanel.querySelector('.undo-clue-btn')
    if (undoBtn) {
      undoBtn.addEventListener('click', (e) => {
        const wordKey = e.target.dataset.wordKey
        this.undoClueForWord(wordKey, wordInfo)
      })
    }
  }

  // Apply a clue to the current word
  useClueForCurrentWord(clueId, answer, wordInfo, completions = []) {
    console.log('🎯 Applying clue:', answer, 'with completions:', completions)
    
    // Add this clue to the used clues set
    this.usedClueIds.add(clueId.toString())

    // Create a unique key for this word position
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    
    // If there was already a clue applied to this word, remove it from used clues
    const previousClue = this.appliedClues.get(wordKey)
    if (previousClue) {
      this.usedClueIds.delete(previousClue.clueId.toString())
    }

    // Store the applied clue information
    this.appliedClues.set(wordKey, {
      clueId: clueId,
      clueText: this.element.querySelector(`[data-clue-id="${clueId}"] .clue-text`).textContent,
      answer: answer,
      wordInfo: { ...wordInfo }
    })

    // Process any completed intersections
    completions.forEach(completion => {
      console.log('🔗 Auto-applying completed intersection:', completion)
      
      // Mark this clue as used
      this.usedClueIds.add(completion.clue_id.toString())
      
      // Find the word info for this intersecting word
      const intersectingWordInfo = this.findWordInfoByNumber(completion.number, completion.direction)
      if (intersectingWordInfo) {
        const intersectingWordKey = `${intersectingWordInfo.startRow},${intersectingWordInfo.startCol},${intersectingWordInfo.direction}`
        
        // Store the applied clue information
        this.appliedClues.set(intersectingWordKey, {
          clueId: completion.clue_id,
          clueText: completion.clue_text,
          answer: completion.answer,
          wordInfo: { ...intersectingWordInfo },
          autoApplied: true // Mark as automatically applied
        })
        
        console.log('✅ Auto-applied clue for', completion.number, completion.direction, ':', completion.answer)
      }
    })

    // Save the clue association to the puzzle (if we have a puzzle ID)
    if (this.puzzleIdValue) {
      this.savePuzzleClue(clueId, wordInfo.number, wordInfo.direction)
    }
    
    // Fire event to notify main controller
    const event = new CustomEvent('clue-applied', {
      detail: { 
        clueId, 
        answer, 
        wordInfo, 
        completions, 
        appliedClues: this.appliedClues, 
        usedClueIds: this.usedClueIds 
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)
    
    // Refresh the clues suggestions to show the undo option
    this.displayCluesSuggestions([], wordInfo)
    
    // Update the clues preview
    this.updateCluesPreview()
  }

  // Find word info by number and direction
  findWordInfoByNumber(number, direction) {
    // This would need to be implemented by searching through the grid
    // For now, return null as a placeholder
    console.warn('findWordInfoByNumber not yet implemented in clue management controller')
    return null
  }

  // Save puzzle clue to server
  savePuzzleClue(clueId, number, direction) {
    fetch('/crossword_game/save_puzzle_clue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        puzzle_id: this.puzzleIdValue,
        clue_id: clueId,
        number: number,
        direction: direction
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Saved clue ${clueId} for word ${number} ${direction}`)
      } else {
        console.error('Failed to save puzzle clue:', data.error)
      }
    })
    .catch(error => {
      console.error('Error saving puzzle clue:', error)
    })
  }

  // Undo a clue application
  undoClueForWord(wordKey, currentWordInfo) {
    const appliedClue = this.appliedClues.get(wordKey)
    if (!appliedClue) return

    // Remove the clue from used clues set
    this.usedClueIds.delete(appliedClue.clueId.toString())

    // Remove the clue from applied clues
    this.appliedClues.delete(wordKey)

    // Fire event to notify main controller
    const event = new CustomEvent('clue-undone', {
      detail: { 
        wordKey, 
        wordInfo: appliedClue.wordInfo, 
        appliedClues: this.appliedClues 
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)
    
    // Update the clues preview
    this.updateCluesPreview()
  }

  // Clear clue suggestions display
  clearCluesSuggestions() {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (cluesPanel) {
      cluesPanel.innerHTML = '<p class="no-selection">Select a word to see matching clues</p>'
    }
  }

  // Update the clues preview display
  updateCluesPreview() {
    const acrossList = this.element.querySelector('#across-clues-list')
    const downList = this.element.querySelector('#down-clues-list')
    
    if (!acrossList || !downList) return

    const acrossClues = []
    const downClues = []

    // We need the numbering from the main controller - fire event to request it
    const event = new CustomEvent('update-clues-preview', {
      detail: { appliedClues: this.appliedClues },
      bubbles: true
    })
    this.element.dispatchEvent(event)
  }

  // Process clues preview update with numbering data
  processCluesPreviewUpdate(numbering) {
    const acrossList = this.element.querySelector('#across-clues-list')
    const downList = this.element.querySelector('#down-clues-list')
    
    if (!acrossList || !downList) return

    const acrossClues = []
    const downClues = []

    // Collect all applied clues organized by number and direction
    for (const [wordKey, appliedClue] of this.appliedClues.entries()) {
      const wordInfo = appliedClue.wordInfo
      const wordNumber = numbering[`${wordInfo.startRow},${wordInfo.startCol}`]
      
      if (wordNumber) {
        const clueEntry = {
          number: wordNumber,
          clueText: appliedClue.clueText,
          answer: appliedClue.answer
        }
        
        if (wordInfo.direction === 'across') {
          acrossClues.push(clueEntry)
        } else {
          downClues.push(clueEntry)
        }
      }
    }

    // Sort by number
    acrossClues.sort((a, b) => a.number - b.number)
    downClues.sort((a, b) => a.number - b.number)

    // Update across clues
    if (acrossClues.length === 0) {
      acrossList.innerHTML = '<p class="no-clues-yet">No across clues yet</p>'
    } else {
      acrossList.innerHTML = acrossClues.map(clue => 
        `<div class="clue-entry">
          <span class="clue-number">${clue.number}.</span> ${clue.clueText}
        </div>`
      ).join('')
    }

    // Update down clues
    if (downClues.length === 0) {
      downList.innerHTML = '<p class="no-clues-yet">No down clues yet</p>'
    } else {
      downList.innerHTML = downClues.map(clue => 
        `<div class="clue-entry">
          <span class="clue-number">${clue.number}.</span> ${clue.clueText}
        </div>`
      ).join('')
    }
  }
}
