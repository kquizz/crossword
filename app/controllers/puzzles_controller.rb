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

    result = PuzzleImportService.import_from_puz_file(params[:puz_file])

    if result[:success]
      redirect_to result[:puzzle], notice: "Puzzle '#{result[:puzzle].title}' was successfully imported!"
    else
      redirect_to puzzles_path, alert: "Error importing .puz file: #{result[:errors].join(', ')}"
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
end
