class TurboGameController < ApplicationController
  before_action :initialize_grid, only: [ :play, :update_cell, :select_cell ]

  def play
    @puzzle = find_puzzle
    @grid = @puzzle.blank_grid || generate_empty_grid
    @mode = params[:mode] || "play"
    @selected_row = session[:selected_row] || 0
    @selected_col = session[:selected_col] || 0
  end

  def update_cell
    row = params[:row].to_i
    col = params[:col].to_i
    value = params[:value]&.upcase

    # Update grid in session
    @grid[row][col] = value
    session[:turbo_grid] = @grid

    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.replace(
          "cell_#{row}_#{col}",
          partial: "cell",
          locals: { row: row, col: col, value: value, selected: false }
        )
      end
    end
  end

  def select_cell
    row = params[:row].to_i
    col = params[:col].to_i

    # Update selected position
    old_row = session[:selected_row] || 0
    old_col = session[:selected_col] || 0

    session[:selected_row] = row
    session[:selected_col] = col

    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: [
          # Remove selection from old cell
          turbo_stream.replace(
            "cell_#{old_row}_#{old_col}",
            partial: "cell",
            locals: { row: old_row, col: old_col, value: @grid[old_row][old_col], selected: false }
          ),
          # Add selection to new cell
          turbo_stream.replace(
            "cell_#{row}_#{col}",
            partial: "cell",
            locals: { row: row, col: col, value: @grid[row][col], selected: true }
          )
        ]
      end
    end
  end

  private

    def initialize_grid
      @grid = session[:turbo_grid] || generate_empty_grid
    end

    def find_puzzle
      if params[:id]
        Puzzle.find(params[:id])
      else
        Puzzle.last # Fallback to last puzzle
      end
    rescue ActiveRecord::RecordNotFound
      nil
    end

    def generate_empty_grid(width = 15, height = 15)
      Array.new(height) { Array.new(width) { nil } }
    end
end
