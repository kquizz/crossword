class PuzzleImportService
  def self.import_from_puz_file(puz_file)
    new(puz_file).import
  end

  def initialize(puz_file)
    @puz_file = puz_file
  end

  def import
    Rails.logger.info "📥 Importing .puz file: #{@puz_file.original_filename} (#{@puz_file.size} bytes)"

    puzzle_data = PuzFile.import_from_binary(@puz_file.read)
    Rails.logger.info "✅ Successfully parsed .puz file: #{puzzle_data.inspect}"

    # Create puzzle
    puzzle = create_puzzle(puzzle_data)

    if puzzle.persisted?
      Rails.logger.info "✅ Puzzle saved successfully: #{puzzle.id}"
      import_clues(puzzle, puzzle_data[:clues])
      { success: true, puzzle: puzzle }
    else
      Rails.logger.error "❌ Puzzle save failed: #{puzzle.errors.full_messages}"
      { success: false, errors: puzzle.errors.full_messages }
    end
  rescue => e
    Rails.logger.error "❌ PUZ Import Error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    { success: false, errors: [ e.message ] }
  end

  private

    def create_puzzle(puzzle_data)
      Puzzle.create(
        title: puzzle_data[:title].presence || "Imported Puzzle",
        description: "Imported from #{@puz_file.original_filename}",
        width: puzzle_data[:width],
        height: puzzle_data[:height],
        solution_grid: format_solution_grid_for_storage(puzzle_data[:solution]),
        blank_grid: create_blank_grid_from_solution(puzzle_data[:solution]),
        difficulty: 1,
        published: false
      )
    end

    def import_clues(puzzle, clues_data)
      clues_imported = 0
      clues_failed = 0

      # Import across clues
      clues_data[:across]&.each do |clue_info|
        if import_single_clue(puzzle, clue_info, "across")
          clues_imported += 1
        else
          clues_failed += 1
        end
      end

      # Import down clues
      clues_data[:down]&.each do |clue_info|
        if import_single_clue(puzzle, clue_info, "down")
          clues_imported += 1
        else
          clues_failed += 1
        end
      end

      Rails.logger.info "✅ Imported #{clues_imported} clues, #{clues_failed} failed"
    end

    def import_single_clue(puzzle, clue_info, direction)
      clue = Clue.create!(
        clue_text: sanitize_clue_text(clue_info[:clue]),
        answer: clue_info[:answer],
        difficulty: puzzle.difficulty,
        category: "imported"
      )

      # Create the puzzle-clue association
      PuzzleClue.create!(
        puzzle: puzzle,
        clue: clue,
        number: clue_info[:number],
        direction: direction
      )

      true
    rescue => e
      Rails.logger.warn "⚠️ Failed to import #{direction} clue: #{clue_info[:clue]} -> #{clue_info[:answer]} (#{e.message})"
      false
    end

    def sanitize_clue_text(text)
      # Clean up any encoding issues and sanitize the clue text
      return "" if text.blank?

      # Force UTF-8 encoding and replace invalid characters
      text.to_s.force_encoding("UTF-8")
        .gsub(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/, "") # Keep printable ASCII and Latin chars
        .strip
    end

    def format_solution_grid_for_storage(solution_grid)
      # Convert 2D array to format expected by Puzzle model
      if solution_grid.is_a?(Array)
        solution_grid.to_json
      else
        solution_grid.to_s
      end
    end

    def create_blank_grid_from_solution(solution_grid)
      # Create blank grid that matches the solution grid structure
      # but with empty strings for white squares and # for black squares
      blank_grid = solution_grid.map do |row|
        row.map { |cell| cell == "#" ? "#" : "" }
      end
      blank_grid.to_json
    end
end
