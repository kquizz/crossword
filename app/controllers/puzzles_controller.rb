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
