require "httparty"
require "nokogiri"

class NytCrosswordScraper
  include HTTParty
  base_uri "https://nytcrosswordanswers.org"

  def initialize(date = nil)
    @date = date || Date.current.strftime("%m-%d-%y")
    @url = "/nyt-crossword-answers-#{@date}/"
  end

  def scrape_clues
    puts "Scraping clues from: #{self.class.base_uri}#{@url}"

    response = self.class.get(@url)

    unless response.success?
      Rails.logger.error "Failed to fetch page: #{response.code}"
      return { across: [], down: [] }
    end

    doc = Nokogiri::HTML(response.body)

    {
      across: extract_clues_from_section(doc, "Across"),
      down: extract_clues_from_section(doc, "Vertical")
    }
  end

  def save_clues_to_database!(force: false)
    # Check if we've already scraped this date
    category = "NYT #{@date}"
    existing_count = Clue.where(category: category).count

    if existing_count > 0 && !force
      puts "⚠️  Clues for #{@date} already exist (#{existing_count} clues found)"
      puts "Skipping to avoid duplicates. Use force: true to re-scrape."
      return 0
    end

    # If forcing a re-scrape, delete existing clues for this date
    if force && existing_count > 0
      puts "🗑️  Force mode: Deleting #{existing_count} existing clues for #{@date}"
      Clue.where(category: category).delete_all
    end

    clue_data = scrape_clues
    saved_count = 0

    ActiveRecord::Base.transaction do
      # Save ACROSS clues
      clue_data[:across].each do |clue_info|
        clue = Clue.find_or_create_by(
          clue_text: clue_info[:clue],
          answer: clue_info[:answer]
        ) do |c|
          c.difficulty = determine_difficulty(clue_info[:answer])
          c.category = category
          c.length = clue_info[:answer].length
          c.date_used = @date.is_a?(String) ? Date.strptime(@date, "%m-%d-%y") : @date
        end
        saved_count += 1 if clue.persisted?
      end

      # Save DOWN clues
      clue_data[:down].each do |clue_info|
        clue = Clue.find_or_create_by(
          clue_text: clue_info[:clue],
          answer: clue_info[:answer]
        ) do |c|
          c.difficulty = determine_difficulty(clue_info[:answer])
          c.category = category
          c.length = clue_info[:answer].length
          c.date_used = @date.is_a?(String) ? Date.strptime(@date, "%m-%d-%y") : @date
        end
        saved_count += 1 if clue.persisted?
      end
    end

    puts "Saved #{saved_count} clues to database"
    saved_count
  end

  private

    def extract_clues_from_section(doc, section_name)
      clues = []

      # Find the section header - updated to match actual HTML
      section_header = doc.at("h3:contains('NYT #{section_name} Clues')")
      return clues unless section_header

      # Get the UL element that follows the header
      ul_element = section_header.next_element
      return clues unless ul_element && ul_element.name == "ul"

      # Parse the text content of the UL
      text_content = ul_element.text
      # Split by lines and process each potential clue
      text_content.split("\n").each do |line|
              line = line.strip
              next if line.empty?
              puts "DEBUG: Clue line: '#{line}'"

              # New regex: clue text followed by answer (3+ uppercase letters) at end of line
              if match = line.match(/^(.*?)([A-Z]{3,})$/)
                clue_text = match[1].strip
                answer = match[2].strip.upcase

                clues << {
                  clue: clue_text,
                  answer: answer,
                  direction: section_name.downcase == "across" ? "across" : "down"
                }
              else
                puts "DEBUG: No match for line: '#{line}'"
              end
            end

      clues
    end

    def determine_difficulty(answer)
      case answer.length
      when 1..4
        "easy"
      when 5..8
        "medium"
      else
        "hard"
      end
    end
end
