class CrosswordGameController < ApplicationController
  before_action :load_puzzle, only: [ :play, :update_cell ]

  def play
    @puzzle ||= Puzzle.last # Use the last puzzle (our 5x5 test puzzle)
    if @puzzle
      @grid = @puzzle.grid("play")
    else
      @grid = generate_empty_grid(15, 15)
    end
    @mode = "play"
  end

  def create
    @puzzle = Puzzle.new
    # Default to 15x15 for new puzzles, or use params if provided
    width = params[:width]&.to_i || 15
    height = params[:height]&.to_i || 15
    @grid = params[:grid] ? JSON.parse(params[:grid]) : generate_empty_grid(width, height)
    @mode = "create"
  end

  def update_cell
    respond_to do |format|
      format.json do
        # Handle AJAX updates for cell values
        row = params[:row].to_i
        col = params[:col].to_i
        value = params[:value].to_s.upcase

        if @puzzle && valid_position?(row, col)
          grid = @puzzle.blank_grid
          grid[row][col] = value.empty? ? nil : value
          @puzzle.blank_grid = grid
          @puzzle.save
          render json: { success: true, value: value }
        else
          render json: { success: false, error: "Invalid position" }
        end
      end
    end
  end

  def save_puzzle
    @puzzle = Puzzle.new(puzzle_params)
    if params[:grid]
      grid_data = JSON.parse(params[:grid])
      @puzzle.grid = grid_data
      @puzzle.width = grid_data.first&.length || 15
      @puzzle.height = grid_data.length || 15
    end

    if @puzzle.save
      redirect_to puzzle_path(@puzzle), notice: "Puzzle created successfully!"
    else
      @grid = @puzzle.solution_grid || generate_empty_grid
      @mode = "create"
      render :create
    end
  end

  def save_puzzle_clue
    puzzle = Puzzle.find(params[:puzzle_id])
    clue = Clue.find(params[:clue_id])
    number = params[:number].to_i
    direction = params[:direction]

    # Check if this puzzle clue already exists
    existing_puzzle_clue = puzzle.puzzle_clues.find_by(number: number, direction: direction)

    if existing_puzzle_clue
      # Update existing
      existing_puzzle_clue.update(clue: clue)
      render json: { success: true, message: "Updated existing clue" }
    else
      # Create new
      puzzle_clue = puzzle.puzzle_clues.build(
        clue: clue,
        number: number,
        direction: direction
      )

      if puzzle_clue.save
        render json: { success: true, message: "Clue saved successfully" }
      else
        render json: { success: false, error: puzzle_clue.errors.full_messages.join(", ") }
      end
    end
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, error: "Puzzle or clue not found" }
  rescue => e
    render json: { success: false, error: e.message }
  end

  private

    def load_puzzle
      @puzzle = Puzzle.find(params[:id]) if params[:id]
    end

    def valid_position?(row, col)
      max_height = @puzzle&.height || 15
      max_width = @puzzle&.width || 15
      row >= 0 && row < max_height && col >= 0 && col < max_width
    end

    def generate_empty_grid(width = 15, height = 15)
      Array.new(height) { Array.new(width) { nil } }
    end

    def puzzle_params
      params.require(:puzzle).permit(:title, :description, :difficulty)
    end
end
