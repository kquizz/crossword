class PuzFile
  # .puz file format constants
  MAGIC_STRING = "ACROSS&DOWN\0".freeze
  VERSION = "1.3\0".freeze

  # Grid cell constants
  BLACK_SQUARE = ".".freeze
  EMPTY_SQUARE = "-".freeze

  def initialize
    @width = 0
    @height = 0
    @solution = ""
    @player_grid = ""
    @title = ""
    @author = ""
    @copyright = ""
    @clues = []
    @grid_numbers = []
  end

  # Export a puzzle to .puz format
  def self.export_puzzle(puzzle)
    puz = new
    puz.build_from_puzzle(puzzle)
    puz.to_binary
  end

  # Import a .puz file and create puzzle data
  def self.import_from_file(file_path)
    puz = new
    puz.parse_file(file_path)
    puz.to_puzzle_data
  end

  # Import from binary data
  def self.import_from_binary(binary_data)
    puz = new
    puz.parse_binary(binary_data)
    puz.to_puzzle_data
  end

  def build_from_puzzle(puzzle)
    # Extract grid data from puzzle
    @width = puzzle.width
    @height = puzzle.height
    @title = puzzle.title || "Untitled Puzzle"
    @author = "Created with Crossword App"
    @copyright = ""

    # Build solution and player grids from puzzle data
    @solution = build_solution_grid_from_puzzle(puzzle)
    @player_grid = build_empty_player_grid

    # Extract clues from puzzle
    @clues = extract_clues_from_puzzle(puzzle)

    self
  end

  def parse_file(file_path)
    File.open(file_path, "rb") do |file|
      parse_binary(file.read)
    end
  end

  def parse_binary(data)
    Rails.logger.info "🔍 Parsing .puz file (#{data.length} bytes)"

    # Ensure we have enough data for header
    if data.length < 52
      raise "Invalid .puz file - too short (#{data.length} bytes, need at least 52)"
    end

    # Read header (52 bytes)
    checksum = data[0..1].unpack("v")[0]
    magic = data[2..13]  # Magic string starts at offset 2, not 12

    Rails.logger.info "🔍 Magic string found: #{magic.inspect} (expected: #{MAGIC_STRING.inspect})"

    unless magic == MAGIC_STRING
      raise "Invalid .puz file - magic string mismatch. Got: #{magic.inspect}, expected: #{MAGIC_STRING.inspect}"
    end

    # Skip to dimensions at offset 44
    @width = data[44].ord
    @height = data[45].ord
    num_clues = data[46..47].unpack("v")[0]

    Rails.logger.info "🔍 Puzzle dimensions: #{@width}x#{@height}, #{num_clues} clues"

    # Read solution grid
    solution_start = 52
    @solution = data[solution_start, @width * @height]

    # Read player grid
    player_start = solution_start + @width * @height
    @player_grid = data[player_start, @width * @height]

    # Read strings section
    strings_start = player_start + @width * @height
    strings_data = data[strings_start..-1]

    if strings_data.nil? || strings_data.empty?
      Rails.logger.warn "⚠️ No strings data found"
      @title = ""
      @author = ""
      @copyright = ""
      @clues = []
    else
      # Handle encoding properly - .puz files use Windows-1252 encoding
      strings_data = strings_data.force_encoding("Windows-1252").encode("UTF-8", invalid: :replace, undef: :replace)
      strings = strings_data.split("\0")

      @title = strings[0] || ""
      @author = strings[1] || ""
      @copyright = strings[2] || ""
      @clues = strings[3, num_clues] || []

      Rails.logger.info "🔍 Parsed strings: title='#{@title}', author='#{@author}', #{@clues.length} clues"
    end

    # Generate grid numbers
    generate_grid_numbers

    self
  end

  def to_binary
    # Build header
    header = build_header

    # Build data sections
    data = @solution + @player_grid + build_strings_section

    # Calculate checksums
    file_checksum = calculate_file_checksum(header + data)
    header_checksum = calculate_header_checksum(header[12..-1])

    # Update checksums in header
    header[0..1] = [ file_checksum ].pack("v")
    header[14..15] = [ header_checksum ].pack("v")

    header + data
  end

  def to_puzzle_data
    {
      title: @title,
      author: @author,
      copyright: @copyright,
      width: @width,
      height: @height,
      solution: parse_solution_grid,
      clues: parse_clues_data,
      grid_numbers: @grid_numbers
    }
  end

  private

    def build_header
      header = "\0" * 52

      # Magic string at offset 2
      header[2..13] = MAGIC_STRING

      # Version at offset 24
      header[24..27] = VERSION

      # Dimensions at offset 44-45
      header[44] = @width.chr
      header[45] = @height.chr

      # Number of clues at offset 46-47
      header[46..47] = [ @clues.length ].pack("v")

      # Puzzle type (normal crossword)
      header[48..49] = [ 0x0001 ].pack("v")

      header
    end

    def build_strings_section
      [ @title, @author, @copyright, *@clues ].join("\0") + "\0"
    end

    def calculate_file_checksum(data)
      checksum = 0
      data.each_byte { |byte| checksum = (checksum + byte) & 0xFFFF }
      checksum
    end

    def calculate_header_checksum(header_data)
      checksum = 0
      (0...header_data.length).step(2) do |i|
        word = header_data[i..i + 1].unpack("v")[0] || 0
        checksum = (checksum + word) & 0xFFFF
      end
      checksum
    end

    def build_solution_grid_from_puzzle(puzzle)
      grid = ""
      solution_data = puzzle.solution_grid

      # Parse JSON solution data if it's a string
      if solution_data.is_a?(String)
        begin
          solution_data = JSON.parse(solution_data)
        rescue JSON::ParserError
          Rails.logger.error "Failed to parse solution grid JSON"
          solution_data = []
        end
      end

      if solution_data.is_a?(Array) && solution_data.length > 0
        # Convert 2D array to flat string
        solution_data.each do |row|
          if row.is_a?(Array)
            row.each do |cell|
              # Handle our '#' format for black squares
              if cell == "#" || cell.blank?
                grid += BLACK_SQUARE
              else
                grid += cell.upcase
              end
            end
          else
            # Handle flat array or string
            if row == "#" || row.blank?
              grid += BLACK_SQUARE
            else
              grid += row.upcase
            end
          end
        end
      else
        # Create empty grid if no solution data
        (@height * @width).times do |i|
          grid += "A"  # Placeholder - in practice you'd want actual data
        end
      end

      grid
    end

    def build_empty_player_grid
      EMPTY_SQUARE * (@width * @height)
    end

    def extract_clues_from_puzzle(puzzle)
      # Get clues associated with this puzzle through puzzle_clues
      clues = []

      # Get clues ordered by their position in the puzzle
      puzzle.puzzle_clues.joins(:clue).order(:number, :direction).each do |puzzle_clue|
        clues << puzzle_clue.clue.clue_text
      end

      # If no associated clues, return empty array
      clues.empty? ? [] : clues
    end

    def parse_solution_grid
      grid = []
      @solution.chars.each_slice(@width) do |row|
        grid << row.map { |cell| cell == BLACK_SQUARE ? "#" : cell }
      end
      grid
    end

    def parse_clues_data
      # Split clues into across and down based on grid numbering
      across_clues = []
      down_clues = []
      clue_index = 0

      @grid_numbers.each_with_index do |row, row_idx|
        row.each_with_index do |number, col_idx|
          next if number.nil?

          # Check if this number starts an across word
          if starts_across_word?(row_idx, col_idx)
            across_clues << {
              number: number,
              clue: @clues[clue_index] || "",
              answer: extract_answer_across(row_idx, col_idx)
            }
            clue_index += 1
          end

          # Check if this number starts a down word
          if starts_down_word?(row_idx, col_idx)
            down_clues << {
              number: number,
              clue: @clues[clue_index] || "",
              answer: extract_answer_down(row_idx, col_idx)
            }
            clue_index += 1
          end
        end
      end

      { across: across_clues, down: down_clues }
    end

    def generate_grid_numbers
      @grid_numbers = Array.new(@height) { Array.new(@width) }
      number = 1

      (0...@height).each do |row|
        (0...@width).each do |col|
          next if @solution[row * @width + col] == BLACK_SQUARE

          # A cell gets a number if it starts an across or down word
          if starts_across_word?(row, col) || starts_down_word?(row, col)
            @grid_numbers[row][col] = number
            number += 1
          end
        end
      end
    end

    def starts_across_word?(row, col)
      return false if @solution[row * @width + col] == BLACK_SQUARE
      return false if col > 0 && @solution[row * @width + col - 1] != BLACK_SQUARE
      return false if col >= @width - 1 || @solution[row * @width + col + 1] == BLACK_SQUARE
      true
    end

    def starts_down_word?(row, col)
      return false if @solution[row * @width + col] == BLACK_SQUARE
      return false if row > 0 && @solution[(row - 1) * @width + col] != BLACK_SQUARE
      return false if row >= @height - 1 || @solution[(row + 1) * @width + col] == BLACK_SQUARE
      true
    end

    def extract_answer_across(row, col)
      answer = ""
      current_col = col

      while current_col < @width && @solution[row * @width + current_col] != BLACK_SQUARE
        answer += @solution[row * @width + current_col]
        current_col += 1
      end

      answer
    end

    def extract_answer_down(row, col)
      answer = ""
      current_row = row

      while current_row < @height && @solution[current_row * @width + col] != BLACK_SQUARE
        answer += @solution[current_row * @width + col]
        current_row += 1
      end

      answer
    end
end
