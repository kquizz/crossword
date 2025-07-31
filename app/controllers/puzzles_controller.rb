class PuzzlesController < ApplicationController
  before_action :set_puzzle, only: %i[ show edit update destroy ]

  # GET /puzzles or /puzzles.json
  def index
    @puzzles = Puzzle.all
  end

  # GET /puzzles/1 or /puzzles/1.json
  def show
  end

  # GET /puzzles/new
  def new
    @puzzle = Puzzle.new
  end

  # GET /puzzles/1/edit
  def edit
  end

  # POST /puzzles or /puzzles.json
  def create
    @puzzle = Puzzle.new(puzzle_params)

    respond_to do |format|
      if @puzzle.save
        format.html { redirect_to @puzzle, notice: "Puzzle was successfully created." }
        format.json { render :show, status: :created, location: @puzzle }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @puzzle.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /puzzles/1 or /puzzles/1.json
  def update
    respond_to do |format|
      if @puzzle.update(puzzle_params)
        format.html { redirect_to @puzzle, notice: "Puzzle was successfully updated." }
        format.json { render :show, status: :ok, location: @puzzle }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @puzzle.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /puzzles/1 or /puzzles/1.json
  def destroy
    @puzzle.destroy!

    respond_to do |format|
      format.html { redirect_to puzzles_path, status: :see_other, notice: "Puzzle was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  # GET /puzzles/1/export.puz - Export puzzle as .puz file
  def export_puz
    set_puzzle

    begin
      puz_data = PuzFile.export_puzzle(@puzzle)
      filename = "#{@puzzle.title.parameterize}-#{@puzzle.id}.puz"

      send_data puz_data,
                filename: filename,
                type: "application/octet-stream",
                disposition: "attachment"
    rescue => e
      Rails.logger.error "PUZ Export Error: #{e.message}"
      redirect_to @puzzle, alert: "Error exporting puzzle: #{e.message}"
    end
  end

  # POST /puzzles/import_puz - Import a .puz file
  def import_puz
    unless params[:puz_file].present?
      redirect_to puzzles_path, alert: "Please select a .puz file to import."
      return
    end

    begin
      puz_file = params[:puz_file]
      Rails.logger.info "📥 Importing .puz file: #{puz_file.original_filename} (#{puz_file.size} bytes)"

      puzzle_data = PuzFile.import_from_binary(puz_file.read)
      Rails.logger.info "✅ Successfully parsed .puz file: #{puzzle_data.inspect}"

      @puzzle = Puzzle.new(
        title: puzzle_data[:title].presence || "Imported Puzzle",
        description: "Imported from #{puz_file.original_filename}",
        width: puzzle_data[:width],
        height: puzzle_data[:height],
        solution_grid: format_solution_grid_for_storage(puzzle_data[:solution]),
        blank_grid: create_blank_grid_from_solution(puzzle_data[:solution]),
        difficulty: 1,
        published: false
      )

      if @puzzle.save
        Rails.logger.info "✅ Puzzle saved successfully: #{@puzzle.id}"

        # Import clues
        import_clues_from_puz_data(@puzzle, puzzle_data[:clues])

        redirect_to @puzzle, notice: "Puzzle '#{@puzzle.title}' was successfully imported!"
      else
        Rails.logger.error "❌ Puzzle save failed: #{@puzzle.errors.full_messages}"
        redirect_to puzzles_path, alert: "Error importing puzzle: #{@puzzle.errors.full_messages.join(', ')}"
      end
    rescue => e
      Rails.logger.error "❌ PUZ Import Error: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      redirect_to puzzles_path, alert: "Error importing .puz file: #{e.message}"
    end
  end

  # GET /puzzles/import - Show import form
  def import_form
  end

  private

    # Use callbacks to share common setup or constraints between actions.
    def set_puzzle
      @puzzle = Puzzle.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def puzzle_params
      params.expect(puzzle: [ :title, :description, :solution_grid, :blank_grid, :width, :height, :difficulty, :published ])
    end

    def import_clues_from_puz_data(puzzle, clues_data)
      clues_imported = 0
      clues_failed = 0

      # Import across clues
      clues_data[:across]&.each do |clue_info|
        begin
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
            direction: "across"
          )

          clues_imported += 1
        rescue => e
          Rails.logger.warn "⚠️ Failed to import across clue: #{clue_info[:clue]} -> #{clue_info[:answer]} (#{e.message})"
          clues_failed += 1
        end
      end

      # Import down clues
      clues_data[:down]&.each do |clue_info|
        begin
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
            direction: "down"
          )

          clues_imported += 1
        rescue => e
          Rails.logger.warn "⚠️ Failed to import down clue: #{clue_info[:clue]} -> #{clue_info[:answer]} (#{e.message})"
          clues_failed += 1
        end
      end

      Rails.logger.info "✅ Imported #{clues_imported} clues, #{clues_failed} failed"
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

    def create_blank_grid(width, height)
      # Create empty grid for player state
      Array.new(height) { Array.new(width, "") }.to_json
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
