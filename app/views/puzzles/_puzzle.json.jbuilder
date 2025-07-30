json.extract! puzzle, :id, :title, :description, :solution_grid, :blank_grid, :width, :height, :difficulty, :published, :created_at, :updated_at
json.url puzzle_url(puzzle, format: :json)
